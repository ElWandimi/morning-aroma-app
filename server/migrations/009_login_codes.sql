-- Real OTP (email-code) login. Deliberately its own table, not columns on `users` (the way
-- reset_token_hash/reset_token_expires are) -- a code can legitimately be requested for an email
-- that has no account yet (this is passwordless login AND signup combined, same principle as
-- Google sign-in creating an account on first use), so there's no user row to attach it to at
-- request time.

CREATE TABLE IF NOT EXISTS login_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  -- Hashed (sha256), same principle as reset_token_hash -- never the raw code at rest.
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  -- Mirrors the 3-attempt lockout the frontend already simulated before this was real --
  -- enforced server-side now, not just in client-side UI state that meant nothing.
  attempts    INT NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes (email);
