// db.js — SQLite database setup (users + history)
const Database = require('better-sqlite3');
const path = require('path');

const DB_DIR  = process.env.DB_PATH ? require('path').dirname(process.env.DB_PATH) : __dirname;
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_FILE);
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

  CREATE TABLE IF NOT EXISTS debate_responses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    session_id  TEXT NOT NULL,
    round       INTEGER DEFAULT 0,
    model_id    TEXT NOT NULL,
    provider    TEXT NOT NULL,
    response    TEXT NOT NULL,
    cost_usd    REAL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_debate_session ON debate_responses(session_id);

  CREATE TABLE IF NOT EXISTS debate_votes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER,
    session_id          TEXT NOT NULL,
    voter_model_id      TEXT NOT NULL,
    voter_provider      TEXT NOT NULL,
    voted_for_model_id  TEXT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_debate_votes_session ON debate_votes(session_id);

  CREATE TABLE IF NOT EXISTS projects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    instructions TEXT DEFAULT '',
    color        TEXT DEFAULT '#58a6ff',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS project_attachments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL,
    content    TEXT NOT NULL,
    size       INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_proj_attach ON project_attachments(project_id);

  CREATE TABLE IF NOT EXISTS project_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    user_id    INTEGER NOT NULL,
    added_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, session_id)
  );
  CREATE INDEX IF NOT EXISTS idx_proj_sessions ON project_sessions(project_id);

  -- ── User plans & billing ──────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS plans (
    id              TEXT PRIMARY KEY,          -- 'free' | 'starter' | 'pro' | 'business'
    name            TEXT NOT NULL,
    price_eur       REAL NOT NULL DEFAULT 0,   -- monthly subscription price
    monthly_budget  REAL NOT NULL DEFAULT 3,   -- max API spend USD/month
    max_models      INTEGER NOT NULL DEFAULT 2,
    web_search      INTEGER NOT NULL DEFAULT 0,
    projects        INTEGER NOT NULL DEFAULT 0,
    history_days    INTEGER NOT NULL DEFAULT 7,
    stripe_price_id TEXT                       -- Stripe Price ID for this plan
  );

  INSERT OR IGNORE INTO plans VALUES
    ('free',     'Free',     0,      3,    2,  0, 0,  7,  NULL),
    ('starter',  'Starter',  9.99,   25,   4,  1, 1,  30, NULL),
    ('pro',      'Pro',      29.99,  100,  99, 1, 1,  90, NULL),
    ('business', 'Business', 99.00,  500,  99, 1, 1, 365, NULL);

  -- Billing events log
  CREATE TABLE IF NOT EXISTS billing_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,  -- 'charge' | 'subscription_created' | 'quota_paused' | 'reset'
    amount_usd  REAL DEFAULT 0,
    description TEXT,
    stripe_id   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_events(user_id, created_at DESC);
`);

// Add billing columns to users — idempotent (try/catch skips "column already exists")
// NOTE: SQLite DEFAULT only accepts constant literals, NOT function calls like date('now',...)
const userBillingCols = [
  `ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'`,
  `ALTER TABLE users ADD COLUMN monthly_cost_usd REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN billing_period_start TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`,
  `ALTER TABLE users ADD COLUMN plan_expires_at TEXT`,
  `ALTER TABLE users ADD COLUMN paused INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of userBillingCols) {
  try {
    db.exec(sql);
  } catch (e) {
    // Silently ignore "duplicate column" errors; re-throw anything unexpected
    if (!e.message.includes('duplicate column')) {
      console.warn('[db migration]', e.message);
    }
  }
}
// Back-fill billing_period_start for existing users who don't have it yet
db.prepare(`
  UPDATE users SET billing_period_start = strftime('%Y-%m-01', 'now')
  WHERE billing_period_start IS NULL
`).run();

module.exports = db;
