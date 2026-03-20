// db.js — SQLite database setup (users + history)
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT UNIQUE NOT NULL,
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    total_cost_usd REAL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id    TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    provider      TEXT NOT NULL,
    model_id      TEXT NOT NULL,
    model_label   TEXT,
    prompt        TEXT NOT NULL,
    response      TEXT NOT NULL,
    input_tokens  INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd      REAL DEFAULT 0,
    duration_ms   INTEGER DEFAULT 0,
    is_integrator INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_history_session ON history(session_id);
`);

module.exports = db;
