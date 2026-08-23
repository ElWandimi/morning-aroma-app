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
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
