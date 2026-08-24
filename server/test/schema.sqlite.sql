-- Test-only schema, SQLite-compatible. Never shipped — migrations/001_init.sql (Postgres) is the
-- real one. Exists purely so this session's auth logic can be verified against a real database
-- given this sandbox can't install actual Postgres.
CREATE TABLE users (
  id                     TEXT PRIMARY KEY,
  email                  TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  password_hash          TEXT NOT NULL,
  role                   TEXT NOT NULL DEFAULT 'customer',
  permissions            TEXT NOT NULL DEFAULT '[]',
  two_factor_enabled     INTEGER NOT NULL DEFAULT 0,
  notifications_enabled  INTEGER NOT NULL DEFAULT 1,
  reset_token_hash       TEXT,
  reset_token_expires    TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
