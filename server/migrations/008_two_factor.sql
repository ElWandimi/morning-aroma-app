-- Real TOTP-based two-factor authentication.
-- `two_factor_enabled` already existed (001_init.sql) but was never wired to anything real --
-- the Settings toggle just flipped a client-side boolean. This adds what's actually needed to
-- make it real: a confirmed secret (only set once setup is verified), a pending secret (set
-- during setup, before the user has proven they can actually generate a matching code), and
-- one-time backup codes for when the authenticator device itself is lost.

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT;
-- Hashed (sha256, same principle as reset_token_hash below it) -- never the raw codes. Each one
-- is removed from this array the moment it's used, so it can never be replayed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[] NOT NULL DEFAULT '{}';
