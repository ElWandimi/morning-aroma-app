-- Morning Aroma backend — initial schema
-- Run this against a real Postgres database (Railway provisions one directly).
-- Scoped to just auth for this phase — see ROADMAP.md Tier 2 for the rest of the data model,
-- which mirrors prisma/schema.prisma at the repo root (kept there as the full reference).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'staff' | 'super_admin'
  permissions         TEXT[] NOT NULL DEFAULT '{}',      -- admin section names, only meaningful for 'staff'
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  reset_token_hash    TEXT,             -- sha256 of the reset token sent to the user; never store the raw token
  reset_token_expires TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
