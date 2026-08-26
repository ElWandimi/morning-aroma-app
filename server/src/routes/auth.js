const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { hashPassword, verifyPassword, isPasswordStrongEnough } = require("../utils/password");
const { signAccessToken, generateResetToken, hashResetToken, signPendingTwoFactorToken, verifyPendingTwoFactorToken } = require("../utils/tokens");
const { newSecret, totpQrCode, verifyTotp, generateBackupCodes, hashBackupCode } = require("../utils/twoFactor");
const { requireAuth } = require("../middleware/requireAuth");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../utils/email");

const router = express.Router();

// A dummy hash to compare against when a login's email isn't found — bcrypt.compare takes
// roughly the same time whether it matches or not, so running it even on a "no such user" path
// keeps the response timing consistent between "wrong password" and "no such account", rather
// than letting an attacker distinguish the two just by how fast the response comes back.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0eNwUeIB0ByLA4x/LurpKMoY2rrRj5G";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // A real limit of 20 protects against brute-forcing login/register in production. Test mode
  // needs it raised, not disabled -- a thorough test suite legitimately makes far more requests
  // to these routes in a single short run than any real user session would, and the limiter
  // being active at all (just with more headroom) still catches a genuine regression where some
  // code path starts looping or retrying unexpectedly.
  max: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});
router.use(authLimiter);

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    // Explicit coercion, not just passed through -- Postgres's driver returns a real boolean for
    // a BOOLEAN column, but this keeps the API response shape guaranteed regardless of what the
    // underlying driver happens to hand back (the SQLite test adapter, for one, returns 0/1).
    twoFactorEnabled: !!row.two_factor_enabled,
    notificationsEnabled: row.notifications_enabled,
  };
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!isPasswordStrongEnough(password)) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name is required." });

  const cleanEmail = email.trim().toLowerCase();
  const existing = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
  // Registration is the one place it's fine (and expected UX) to say an email is already taken --
  // unlike login or password-reset-request, where doing the same thing would let an attacker
  // enumerate which emails have accounts at all.
  if (existing.rows.length > 0) return res.status(409).json({ error: "An account with that email already exists." });

  // Bootstrap: the very first account created on a fresh deployment becomes super_admin
  // automatically. Unlike the old in-memory demo (which had a hardcoded seeded admin), a real
  // database starts genuinely empty -- without this, there would be no way to ever reach the
  // admin dashboard at all. Only applies when the users table is completely empty, so it can't be
  // used to grant admin access later by any other means. Known, accepted tradeoff: two people
  // registering at the exact same instant on a truly empty database could theoretically both see
  // a count of zero and both become admin -- a real race condition, but not a realistic risk for
  // how this actually gets deployed (one business owner, registering their own first account).
  const countResult = await query("SELECT COUNT(*) AS count FROM users", []);
  const isFirstUser = parseInt(countResult.rows[0].count, 10) === 0;
  const role = isFirstUser ? "super_admin" : "customer";

  const passwordHash = await hashPassword(password);
  const result = await query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
    [cleanEmail, name.trim(), passwordHash, role]
  );
  const user = result.rows[0];
  // Fire-and-forget: registration succeeding must never depend on email sending succeeding.
  // Right now this can't actually fail (it's a console.log, see utils/email.js), but writing it
  // this way now means the moment a real provider is connected and this can genuinely fail
  // (network issue, rate limit), a slow or broken email send still won't block or crash the
  // response the user is actually waiting on.
  sendWelcomeEmail(user).catch((err) => console.error("Failed to send welcome email:", err));
  res.status(201).json({ user: publicUser(user), token: signAccessToken(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const result = await query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) return res.status(401).json({ error: "Invalid email or password." });

  if (user.two_factor_enabled) {
    // Correct password alone isn't enough to sign in on an account with 2FA on. This is
    // deliberately NOT a real access token -- see signPendingTwoFactorToken's own comment for why
    // it can't be used to reach anything except finishing the challenge at /2fa/verify-login.
    return res.json({ requiresTwoFactor: true, pendingToken: signPendingTwoFactorToken(user) });
  }

  res.json({ user: publicUser(user), token: signAccessToken(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "Account no longer exists." });
  res.json({ user: publicUser(user) });
});

// Stateless JWT -- there's no server-side session to destroy. This endpoint exists for a
// consistent API shape and as the natural place to add a token blocklist later if that's ever
// needed; for now the actual "logout" work is entirely client-side (discarding the stored token).
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

router.post("/password-reset/request", async (req, res) => {
  const { email } = req.body || {};
  // Always return the same generic response whether or not the email exists, and always take
  // roughly the same code path either way -- this is the password-reset equivalent of the dummy
  // bcrypt compare in /login, for the same reason: not revealing which emails have accounts.
  const genericResponse = { message: "If that email has an account, a reset link has been sent." };
  if (!isValidEmail(email)) return res.json(genericResponse);

  const result = await query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (user) {
    const { raw, hash } = generateResetToken();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await query("UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3", [hash, expires, user.id]);
    sendPasswordResetEmail(email, raw).catch((err) => console.error("Failed to send password reset email:", err));
  }
  res.json(genericResponse);
});

router.post("/password-reset/confirm", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Missing reset token." });
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const hash = hashResetToken(token);
  const result = await query(
    "SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > now()",
    [hash]
  );
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "That reset link is invalid or has expired." });

  const passwordHash = await hashPassword(newPassword);
  await query(
    "UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2",
    [passwordHash, user.id]
  );
  res.json({ message: "Password updated. You can sign in with your new password now." });
});

// --- Two-factor authentication (TOTP) ---
// Setup is a two-step handshake, not one call: /setup generates and stores a *pending* secret and
// hands back a QR code, but doesn't turn 2FA on yet. /verify-setup only enables it once the user
// proves they can actually produce a matching code from it -- otherwise a typo while scanning, or
// a secret that silently failed to save into the authenticator app, would lock someone out of
// their own account the next time they try to sign in.

router.post("/2fa/setup", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "Account no longer exists." });
  if (user.two_factor_enabled) return res.status(400).json({ error: "Two-factor authentication is already enabled." });

  const secret = newSecret();
  await query("UPDATE users SET two_factor_pending_secret = $1 WHERE id = $2", [secret, user.id]);
  const { uri, qrDataUrl } = await totpQrCode(user.email, secret);
  // `secret` is also returned directly (not just inside the QR/uri) for the standard "can't scan?
  // enter this code manually" fallback every real authenticator app offers.
  res.json({ secret, uri, qrDataUrl });
});

router.post("/2fa/verify-setup", requireAuth, async (req, res) => {
  const { code } = req.body || {};
  const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "Account no longer exists." });
  if (!user.two_factor_pending_secret) {
    return res.status(400).json({ error: "Start setup first with /auth/2fa/setup." });
  }

  const valid = await verifyTotp(user.two_factor_pending_secret, code);
  if (!valid) return res.status(400).json({ error: "Incorrect code. Check your authenticator app and try again." });

  const backupCodes = generateBackupCodes();
  await query(
    "UPDATE users SET two_factor_enabled = true, two_factor_secret = $1, two_factor_pending_secret = NULL, two_factor_backup_codes = $2 WHERE id = $3",
    [user.two_factor_pending_secret, backupCodes.map(hashBackupCode), user.id]
  );
  // Returned exactly once, right now -- there is no way to retrieve these again later, since only
  // their hashes are ever stored. Losing them means generating a fresh set (which invalidates the
  // old ones), not recovering the originals.
  res.json({ enabled: true, backupCodes });
});

router.post("/2fa/verify-login", async (req, res) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || typeof pendingToken !== "string") {
    return res.status(400).json({ error: "Missing or invalid sign-in session. Please sign in again." });
  }

  let payload;
  try {
    payload = verifyPendingTwoFactorToken(pendingToken);
  } catch {
    return res.status(401).json({ error: "That sign-in session has expired. Please sign in again." });
  }

  const result = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = result.rows[0];
  if (!user || !user.two_factor_enabled) {
    return res.status(401).json({ error: "That sign-in session is no longer valid. Please sign in again." });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Enter your 6-digit code or a backup code." });
  }

  const totpValid = await verifyTotp(user.two_factor_secret, code);
  if (totpValid) {
    return res.json({ user: publicUser(user), token: signAccessToken(user) });
  }

  // Not a valid live TOTP code -- check whether it matches one of this account's remaining,
  // unused backup codes instead. Removed from the stored list the moment it's used, successful or
  // not this specific request, so the same backup code can never be replayed a second time.
  const hashedInput = hashBackupCode(code);
  const remainingCodes = user.two_factor_backup_codes || [];
  if (remainingCodes.includes(hashedInput)) {
    const updatedCodes = remainingCodes.filter((c) => c !== hashedInput);
    await query("UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2", [updatedCodes, user.id]);
    return res.json({ user: publicUser(user), token: signAccessToken(user), usedBackupCode: true });
  }

  res.status(401).json({ error: "Incorrect code." });
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "Account no longer exists." });

  // Re-confirming the password (not just trusting the existing session) matters here specifically
  // because disabling 2FA is a real security downgrade -- someone with a few minutes of access to
  // an unlocked, already-signed-in device shouldn't be able to turn off the account's second
  // factor without proving they know the password too.
  const ok = await verifyPassword(typeof password === "string" ? password : "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "Incorrect password." });

  await query(
    "UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_pending_secret = NULL, two_factor_backup_codes = $1 WHERE id = $2",
    [[], user.id]
  );
  res.json({ enabled: false });
});

module.exports = router;
