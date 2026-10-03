-- HealthMate database schema (SQLite)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  goal          TEXT NOT NULL DEFAULT 'lose',   -- lose | gain | keep
  lang          TEXT NOT NULL DEFAULT 'en',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS health_metrics (       -- 1 row / user: latest body metrics
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weight     REAL NOT NULL DEFAULT 65,
  height     REAL NOT NULL DEFAULT 170,
  heart_rate INTEGER NOT NULL DEFAULT 72,
  spo2       INTEGER NOT NULL DEFAULT 98
);
CREATE TABLE IF NOT EXISTS weight_logs (          -- weight history (chart)
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  weight   REAL NOT NULL,
  PRIMARY KEY (user_id, log_date)
);
CREATE TABLE IF NOT EXISTS meals (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  calories  INTEGER NOT NULL CHECK (calories > 0),
  log_date  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises (
  id       TEXT PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  minutes  INTEGER NOT NULL CHECK (minutes > 0),
  calories INTEGER NOT NULL CHECK (calories > 0),
  log_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_logs (           -- steps & water per day
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  steps    INTEGER NOT NULL DEFAULT 0,
  water_ml INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, log_date)
);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kcal_goal  INTEGER NOT NULL DEFAULT 2000,
  step_goal  INTEGER NOT NULL DEFAULT 10000,
  water_goal INTEGER NOT NULL DEFAULT 2000,
  rem_water  INTEGER NOT NULL DEFAULT 1,
  rem_ex     INTEGER NOT NULL DEFAULT 1,
  rem_sleep  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_ex_user_date    ON exercises(user_id, log_date);
