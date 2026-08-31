-- Test-only schema, SQLite-compatible. Never shipped — migrations/001_init.sql (Postgres) is the
-- real one. Exists purely so this session's auth logic can be verified against a real database
-- given this sandbox can't install actual Postgres.
CREATE TABLE users (
  id                        TEXT PRIMARY KEY,
  email                     TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  password_hash             TEXT NOT NULL,
  role                      TEXT NOT NULL DEFAULT 'customer',
  permissions               TEXT NOT NULL DEFAULT '[]',
  two_factor_enabled        INTEGER NOT NULL DEFAULT 0,
  two_factor_secret         TEXT,
  two_factor_pending_secret TEXT,
  two_factor_backup_codes   TEXT NOT NULL DEFAULT '[]',
  notifications_enabled     INTEGER NOT NULL DEFAULT 1,
  reset_token_hash          TEXT,
  reset_token_expires       TEXT,
  email_verified            INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  country             TEXT NOT NULL,
  tier                TEXT NOT NULL,
  price_cents         INTEGER NOT NULL,
  stock               INTEGER NOT NULL DEFAULT 0,
  note                TEXT,
  tags                TEXT NOT NULL DEFAULT '{}',
  profile             TEXT NOT NULL DEFAULT '{}',
  growing             TEXT,
  brew_guide          TEXT,
  moment_match        TEXT,
  course              TEXT,
  photo_url           TEXT,
  removed             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE courses (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  blurb                 TEXT NOT NULL,
  instructor            TEXT NOT NULL,
  lessons               INTEGER NOT NULL,
  monthly_price_cents   INTEGER NOT NULL,
  removed               INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_courses_removed ON courses (removed);

CREATE TABLE subscription_plans (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT REFERENCES products(id),
  course_id            TEXT REFERENCES courses(id),
  interval             TEXT NOT NULL,
  amount_kes_cents     INTEGER NOT NULL,
  paystack_plan_code   TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_subscription_plans_product_target ON subscription_plans (product_id, interval, amount_kes_cents) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX idx_subscription_plans_course_target ON subscription_plans (course_id, interval, amount_kes_cents) WHERE course_id IS NOT NULL;

CREATE TABLE subscriptions (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT NOT NULL REFERENCES users(id),
  product_id                  TEXT REFERENCES products(id),
  course_id                   TEXT REFERENCES courses(id),
  quantity                    INTEGER NOT NULL DEFAULT 1,
  interval                    TEXT NOT NULL,
  amount_usd_cents            INTEGER NOT NULL,
  amount_kes_cents            INTEGER NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active',
  shipping_name               TEXT,
  shipping_address            TEXT,
  shipping_city               TEXT,
  paystack_customer_code      TEXT NOT NULL,
  paystack_subscription_code  TEXT NOT NULL,
  paystack_email_token        TEXT NOT NULL,
  next_payment_date           TEXT,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

CREATE TABLE academy_lifetime_access (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) UNIQUE,
  paystack_reference  TEXT NOT NULL UNIQUE,
  amount_usd_cents    INTEGER NOT NULL,
  amount_kes_cents    INTEGER NOT NULL,
  purchased_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE green_beans (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  country             TEXT NOT NULL,
  roasted_id          TEXT,
  price_per_kg_cents  INTEGER NOT NULL,
  stock_kg            INTEGER NOT NULL DEFAULT 0,
  min_order_kg        INTEGER NOT NULL DEFAULT 1,
  cupping_score       INTEGER,
  moisture            TEXT,
  grade               TEXT,
  process             TEXT,
  notes               TEXT,
  removed             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id                  TEXT PRIMARY KEY,
  order_number        INTEGER NOT NULL UNIQUE,
  user_id             TEXT NOT NULL REFERENCES users(id),
  items               TEXT NOT NULL,
  total_cents         INTEGER NOT NULL,
  shipping_name       TEXT NOT NULL,
  shipping_address    TEXT NOT NULL,
  shipping_city       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Processing',
  payment_status      TEXT NOT NULL DEFAULT 'unpaid',
  paystack_reference  TEXT UNIQUE,
  paid_amount_cents   INTEGER,
  paid_currency       TEXT,
  paid_at             TEXT,
  payment_mode        TEXT,
  subscription_id     TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE login_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX login_codes_email_idx ON login_codes (email);

CREATE TABLE email_verification_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX email_verification_codes_user_id_idx ON email_verification_codes (user_id);
