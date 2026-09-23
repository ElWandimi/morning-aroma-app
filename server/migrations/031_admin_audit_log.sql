-- Real, backend-persisted admin audit log -- previously purely client-only, in-memory state
-- (src/context/index.jsx's logAction/auditLog), capped at 200 entries and wiped the moment an
-- admin's browser tab closed or refreshed. A per-row table, not the single-row JSONB pattern used
-- by settings/content_overrides, since this is inherently an append-only event log (one row per
-- admin action, unbounded history, queried by recency) rather than a small set of keyed fields.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Loose (non-FK) reference to the acting user's email, not their id -- mirrors how this worked
  -- client-side (user?.email), and keeps a log entry readable and intact even if that user's
  -- account is later deleted (soft-deleted rows still exist, but this avoids coupling the log's
  -- integrity to that mechanism at all).
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
