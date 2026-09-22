-- Real "delete my account" support, as a soft delete rather than a real DELETE FROM users --
-- explicitly requested this way: a customer who deletes their own account from the frontend
-- should genuinely lose access (logged out immediately, can't sign back in, doesn't show as an
-- active customer anywhere in the admin dashboard) but the underlying row -- their order history,
-- reviews, everything referencing users(id) via foreign keys -- must stay intact and restorable,
-- rather than being destroyed outright or left as an orphaned reference. Same "re-verify against
-- the database on every request" principle migrations/022_token_version.sql already established
-- for session invalidation; this reuses that exact mechanism (see requireAuth in
-- src/middleware/requireAuth.js and the /users/me/delete route in src/routes/auth.js) rather than
-- inventing a second, parallel one.
--
-- NULL means active (the normal, overwhelming majority case) -- deliberately NOT a boolean
-- is_deleted flag, so this column doubles as a real, human-readable "when" for support/audit
-- purposes ("this account was deleted on 2026-09-22") without needing a separate timestamp column
-- alongside a separate boolean that could in principle drift out of sync with each other.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Real, single-purpose partial index: every authenticated request (requireAuth) and every login
-- attempt (POST /auth/login) needs to check "is this specific user currently deleted?" by id or
-- email, and the overwhelming majority of rows will always have deleted_at IS NULL -- indexing
-- only the (rare, in practice) non-NULL rows keeps this index small and cheap to maintain on every
-- write, while still making "find the currently-active user with this email" (already the
-- dominant real query shape here, via idx_users_email) fast.
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;
