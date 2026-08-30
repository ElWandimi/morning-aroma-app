-- Real email verification for password-based registration. Deliberately NOT required for Google
-- sign-in (Google already verifies the email itself before ever handing back a token) or
-- OTP/email-code sign-in (entering a real code sent to that email already IS proof of ownership)
-- -- only /auth/register's own password path creates an account whose email ownership hasn't
-- actually been proven yet.
--
-- Existing users, from before this feature existed, are grandfathered in as verified below --
-- they already proved their email works by signing in successfully in the past, and retroactively
-- locking out real, already-active accounts (including the site's own admin) would be a genuine,
-- unacceptable regression, not a security improvement.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET email_verified = true WHERE email_verified = false;

-- Deliberately its own table, not columns on `users` -- same reasoning as login_codes
-- (009_login_codes.sql): a code needs hashed-at-rest storage, an expiry, and an attempt counter,
-- none of which belong as permanent columns on the user row itself.
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_codes_user_id_idx ON email_verification_codes (user_id);
