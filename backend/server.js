const express = require("express");
const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken");
const fs = require("fs"),
  path = require("path");

const SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const PORT = process.env.PORT || 3000;

// ---- 1. CONNECT TO THE SQL DATABASE ----
// On Render: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (cloud database, data is kept).
// On your PC with no env vars: falls back to the local file healthmate.db.
const db = createClient({
  url:
    process.env.TURSO_DATABASE_URL ||
    "file:" + path.join(__dirname, "healthmate.db"),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const app = express();
app.use((req, res, next) => {
  // CORS: allows Flutter (debug) on another port
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const today = () => new Date().toISOString().slice(0, 10);
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const str = (v, n = 100) => String(v ?? "").slice(0, n);
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  });

// small helpers: one row / many rows
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;

// ---- 2. AUTH ----
const sign = (id) => jwt.sign({ id }, SECRET, { expiresIn: "7d" });
function auth(req, res, next) {
  try {
    req.uid = jwt.verify((req.headers.authorization || "").slice(7), SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const email = str(req.body.email).trim().toLowerCase(),
      pw = str(req.body.password, 200);
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6)
      return res
        .status(400)
        .json({
          error: "Valid email and a password of 6+ characters required",
        });
    if (await get("SELECT 1 FROM users WHERE email=?", [email]))
      return res.status(409).json({ error: "Email already registered" });
    const tx = await db.transaction("write");
    let id;
    try {
      const r = await tx.execute({
        sql: "INSERT INTO users(email,password_hash,name) VALUES(?,?,?)",
        args: [email, bcrypt.hashSync(pw, 10), str(req.body.name)],
      });
      id = Number(r.lastInsertRowid);
      await tx.execute({
        sql: "INSERT INTO health_metrics(user_id) VALUES(?)",
        args: [id],
      });
      await tx.execute({
        sql: "INSERT INTO user_settings(user_id) VALUES(?)",
        args: [id],
      });
      await tx.execute({
        sql: "INSERT INTO weight_logs VALUES(?,?,65)",
        args: [id, today()],
      });
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => {});
      if (/UNIQUE/i.test(String(e.message)))
        return res.status(409).json({ error: "Email already registered" });
      throw e;
    } finally {
      tx.close();
    }
    res.json({ token: sign(id) });
  }),
);

app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const u = await get("SELECT * FROM users WHERE email=?", [
      str(req.body.email).trim().toLowerCase(),
    ]);
    if (!u || !bcrypt.compareSync(str(req.body.password, 200), u.password_hash))
      return res.status(401).json({ error: "Wrong email or password" });
    res.json({ token: sign(Number(u.id)) });
  }),
);

// ---- 3. READ: assemble the user's data from SQL tables ----
async function load(uid) {
  const q = (sql) => all(sql, [uid]);
  const u = await get("SELECT * FROM users WHERE id=?", [uid]);
  const h = await get("SELECT * FROM health_metrics WHERE user_id=?", [uid]);
  const s = await get("SELECT * FROM user_settings WHERE user_id=?", [uid]);
  const steps = {},
    water = {};
  (await q("SELECT * FROM daily_logs WHERE user_id=?")).forEach((r) => {
    steps[r.log_date] = r.steps;
    water[r.log_date] = r.water_ml;
  });
  const plain = (rows) => rows.map((r) => ({ ...r }));
  return {
    me: { name: u.name, email: u.email },
    lang: u.lang,
    profile: { name: u.name, email: u.email, goal: u.goal },
    health: {
      weight: h.weight,
      height: h.height,
      hr: h.heart_rate,
      spo2: h.spo2,
    },
    wHist: plain(
      await q(
        "SELECT log_date d, weight w FROM weight_logs WHERE user_id=? ORDER BY log_date",
      ),
    ),
    meals: plain(
      await q(
        "SELECT id,name,meal_type type,calories kcal,log_date d FROM meals WHERE user_id=? ORDER BY rowid",
      ),
    ),
    ex: plain(
      await q(
        "SELECT id,name,minutes min,calories kcal,log_date d FROM exercises WHERE user_id=? ORDER BY rowid",
      ),
    ),
    steps,
    water,
    goals: { kcal: s.kcal_goal, steps: s.step_goal, water: s.water_goal },
    rem: { w: !!s.rem_water, e: !!s.rem_ex, s: !!s.rem_sleep },
  };
}

// ---- 4. WRITE: validate, then save into SQL tables (one transaction = one batch) ----
async function persist(uid, b) {
  const types = ["breakfast", "lunch", "dinner", "snack"],
    D = (x) => str(x, 10);
  const st = [];
  const add = (sql, args) => st.push({ sql, args });
  add("UPDATE users SET name=?, goal=?, lang=? WHERE id=?", [
    str(b.profile?.name),
    ["lose", "gain", "keep"].includes(b.profile?.goal)
      ? b.profile.goal
      : "lose",
    b.lang === "vi" ? "vi" : "en",
    uid,
  ]);
  const h = b.health || {};
  add(
    "UPDATE health_metrics SET weight=?,height=?,heart_rate=?,spo2=? WHERE user_id=?",
    [
      num(h.weight, 65),
      num(h.height, 170),
      num(h.hr, 72),
      num(h.spo2, 98),
      uid,
    ],
  );
  const g = b.goals || {},
    r = b.rem || {};
  add(
    "UPDATE user_settings SET kcal_goal=?,step_goal=?,water_goal=?,rem_water=?,rem_ex=?,rem_sleep=? WHERE user_id=?",
    [
      num(g.kcal, 2000),
      num(g.steps, 10000),
      num(g.water, 2000),
      +!!r.w,
      +!!r.e,
      +!!r.s,
      uid,
    ],
  );

  for (const t of ["weight_logs", "meals", "exercises", "daily_logs"])
    add(`DELETE FROM ${t} WHERE user_id=?`, [uid]);
  (b.wHist || [])
    .slice(-60)
    .forEach((x) =>
      add("INSERT OR REPLACE INTO weight_logs VALUES(?,?,?)", [
        uid,
        D(x.d),
        num(x.w),
      ]),
    );
  (b.meals || [])
    .slice(-500)
    .forEach(
      (m) =>
        types.includes(m.type) &&
        num(m.kcal) > 0 &&
        add("INSERT OR REPLACE INTO meals VALUES(?,?,?,?,?,?)", [
          str(m.id, 20),
          uid,
          str(m.name),
          m.type,
          num(m.kcal),
          D(m.d),
        ]),
    );
  (b.ex || [])
    .slice(-500)
    .forEach(
      (e) =>
        num(e.min) > 0 &&
        num(e.kcal) > 0 &&
        add("INSERT OR REPLACE INTO exercises VALUES(?,?,?,?,?,?)", [
          str(e.id, 20),
          uid,
          str(e.name),
          num(e.min),
          num(e.kcal),
          D(e.d),
        ]),
    );
  const days = new Set([
    ...Object.keys(b.steps || {}),
    ...Object.keys(b.water || {}),
  ]);
  days.forEach((d) =>
    add("INSERT INTO daily_logs VALUES(?,?,?,?)", [
      uid,
      D(d),
      num(b.steps?.[d]),
      num(b.water?.[d]),
    ]),
  );
  await db.batch(st, "write");
}

app.get(
  "/api/state",
  auth,
  wrap(async (req, res) => res.json(await load(req.uid))),
);
app.put("/api/state", auth, async (req, res) => {
  try {
    await persist(req.uid, req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Invalid data" });
  }
});

// ---- START: create tables (if missing), then listen ----
(async () => {
  try {
    await db.execute("PRAGMA foreign_keys = ON");
  } catch {}
  await db.executeMultiple(
    fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"),
  );
  app.listen(PORT, () =>
    console.log(`HealthMate running at http://localhost:${PORT}`),
  );
})().catch((e) => {
  console.error("Startup failed:", e);
  process.exit(1);
});
