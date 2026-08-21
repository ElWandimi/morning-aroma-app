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
