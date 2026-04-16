// db.js — SQLite database setup (users + history)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR  = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname;
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.db');

// Ensure directory exists (important for Railway volumes)
fs.mkdirSync(DB_DIR, { recursive: true });

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

  CREATE TABLE IF NOT EXISTS votes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    model_id   TEXT NOT NULL,
    vote       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id, model_id)
  );
  CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);

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
    id              TEXT PRIMARY KEY,          -- 'free' | 'starter' | 'pro' | 'enterprise'
    name            TEXT NOT NULL,
    price_eur       REAL NOT NULL DEFAULT 0,   -- monthly subscription price
    monthly_budget  REAL NOT NULL DEFAULT 3,   -- max API spend USD/month
    max_models      INTEGER NOT NULL DEFAULT 2,
    web_search      INTEGER NOT NULL DEFAULT 0,
    projects        INTEGER NOT NULL DEFAULT 0,
    history_days    INTEGER NOT NULL DEFAULT 7,
    stripe_price_id TEXT                       -- Stripe Price ID for this plan
  );

  -- Upsert plans so name/price changes apply on restart even if rows already exist
  INSERT INTO plans VALUES
    ('free',       'Explorer',      0,     3,    4,  0, 0,   0,  NULL),
    ('pro_demo',   'Pro Demo',      0,     3,   99,  1, 1,  30,  NULL),
    ('starter',    'Professional', 29.00, 15,    4,  0, 1,  30,  NULL),
    ('pro',        'Expert',       59.00, 40,   99,  1, 1, 365,  NULL),
    ('enterprise', 'Team',         49.00, 200,  99,  1, 1, 365,  NULL)
  ON CONFLICT(id) DO UPDATE SET
    name            = excluded.name,
    price_eur       = excluded.price_eur,
    monthly_budget  = excluded.monthly_budget,
    max_models      = excluded.max_models,
    web_search      = excluded.web_search,
    projects        = excluded.projects,
    history_days    = excluded.history_days;

  -- Promo codes
  CREATE TABLE IF NOT EXISTS promo_codes (
    code           TEXT PRIMARY KEY,
    plan           TEXT NOT NULL DEFAULT 'pro_demo',  -- plan to grant
    budget_usd     REAL NOT NULL DEFAULT 3,           -- API budget for this promo
    max_uses       INTEGER NOT NULL DEFAULT 1,
    times_used     INTEGER NOT NULL DEFAULT 0,
    expires_at     TEXT,                              -- ISO date or NULL
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Seed promo codes (Pro Demo, $3 budget, 1 use each)
  INSERT OR IGNORE INTO promo_codes (code, plan, budget_usd, max_uses) VALUES
    ('RELI-Q2KYMQ','pro_demo',3,1),('RELI-Y94QR2','pro_demo',3,1),
    ('RELI-JZPY3S','pro_demo',3,1),('RELI-EZEHSL','pro_demo',3,1),
    ('RELI-MJY8ZJ','pro_demo',3,1),('RELI-DZ9RGW','pro_demo',3,1),
    ('RELI-ZF8RME','pro_demo',3,1),('RELI-6HMB4W','pro_demo',3,1),
    ('RELI-JXY9WP','pro_demo',3,1),('RELI-L72KCU','pro_demo',3,1),
    ('RELI-TFQNPP','pro_demo',3,1),('RELI-W2REGH','pro_demo',3,1),
    ('RELI-LN4MXL','pro_demo',3,1),('RELI-BUKX74','pro_demo',3,1),
    ('RELI-DYHWJW','pro_demo',3,1),('RELI-A6KF74','pro_demo',3,1),
    ('RELI-CPX79Z','pro_demo',3,1),('RELI-PUW29Z','pro_demo',3,1),
    ('RELI-2WAMAW','pro_demo',3,1),('RELI-BZT6NC','pro_demo',3,1);

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
  `ALTER TABLE users ADD COLUMN daily_queries INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN daily_queries_date TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN promo_code TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN country TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN city TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN birthdate TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN occupation TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
  `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN verification_token TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN verification_sent_at TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN reset_token_expires TEXT DEFAULT NULL`,
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

// Migrate legacy plan IDs to current schema
db.prepare(`UPDATE users SET plan = 'enterprise' WHERE plan = 'business'`).run();
db.prepare(`DELETE FROM plans WHERE id = 'business'`).run();

// ── Admin tables & indexes ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL REFERENCES users(id),
    action     TEXT NOT NULL,
    target_id  INTEGER,
    details    TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_admin  ON admin_audit_log(admin_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS model_config (
    model_id     TEXT PRIMARY KEY,
    provider     TEXT NOT NULL,
    enabled      INTEGER NOT NULL DEFAULT 1,
    price_input  REAL,
    price_output REAL,
    display_name TEXT,
    sort_order   INTEGER DEFAULT 100,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    value       REAL,
    provider    TEXT,
    model_id    TEXT,
    details     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_type_date ON system_metrics(metric_type, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_users_plan    ON users(plan);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
  CREATE INDEX IF NOT EXISTS idx_history_created  ON history(created_at);
  CREATE INDEX IF NOT EXISTS idx_history_provider ON history(provider, created_at);
  CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(type, created_at DESC);
`);

// Promote ADMIN_EMAIL to superadmin if set
if (process.env.ADMIN_EMAIL) {
  try {
    db.prepare(`UPDATE users SET role = 'superadmin' WHERE email = ? AND role = 'user'`)
      .run(process.env.ADMIN_EMAIL);
  } catch (e) { /* ignore */ }
}

module.exports = db;
