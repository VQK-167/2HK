# HealthMate – Full-stack Web App

**Stack:** HTML/CSS/JS (frontend) · Node.js + Express (REST API) · SQLite (SQL database) · JWT + bcrypt (authentication)

## 1. Run it
Install Node.js 18+ from https://nodejs.org, then in this folder:

    npm install
    npm start

Open http://localhost:3000, create an account and use the app.
The database file `healthmate.db` is created automatically from `schema.sql`.

## 2. Architecture (for your slides)
    Browser (public/index.html)  --HTTP/JSON-->  Express API (server.js)  --SQL-->  SQLite (healthmate.db)

| Method | Endpoint             | Purpose                                  |
|--------|----------------------|------------------------------------------|
| POST   | /api/auth/register   | Create account (password hashed, bcrypt) |
| POST   | /api/auth/login      | Returns a JWT token (valid 7 days)       |
| GET    | /api/state           | Load all of the user's data from SQL     |
| PUT    | /api/state           | Validate and save data (1 transaction)   |

Tables: `users`, `health_metrics`, `weight_logs`, `meals`, `exercises`, `daily_logs`, `user_settings`
(all child tables reference `users(id)` with `ON DELETE CASCADE`).

## 3. How the app connects to SQL (server.js)
    const db = new Database('healthmate.db');          // open / create the database
    db.exec(fs.readFileSync('schema.sql', 'utf8'));    // create tables
    db.prepare('SELECT * FROM meals WHERE user_id=?').all(uid);   // query (parameterized = no SQL injection)

## 4. View / edit the database
Install **DB Browser for SQLite** (https://sqlitebrowser.org), open `healthmate.db`, tab *Browse Data*.
Or in a terminal: `sqlite3 healthmate.db "SELECT * FROM users;"`

## 5. Switch to MySQL (optional)
1. `npm install mysql2` and create the DB: `CREATE DATABASE healthmate;`
2. Run `schema.sql` in MySQL after changing: `INTEGER PRIMARY KEY AUTOINCREMENT` -> `INT AUTO_INCREMENT PRIMARY KEY`,
   `TEXT` keys -> `VARCHAR(255)`, `CURRENT_TIMESTAMP` default stays.
3. In server.js replace better-sqlite3 with a pool and make the handlers `async`:

       const mysql = require('mysql2/promise');
       const pool = mysql.createPool({ host:'localhost', user:'root', password:'***', database:'healthmate' });
       const [rows] = await pool.query('SELECT * FROM meals WHERE user_id=?', [uid]);

## 6. Before real deployment
Set `JWT_SECRET` (e.g. `JWT_SECRET=long-random-text npm start`) and serve over HTTPS.
