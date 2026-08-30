const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { OAuth2Client } = require("google-auth-library");
const { query } = require("../db");
const { hashPassword, verifyPassword, isPasswordStrongEnough } = require("../utils/password");
const { signAccessToken, generateResetToken, hashResetToken, signPendingTwoFactorToken, verifyPendingTwoFactorToken, signPendingEmailVerificationToken, verifyPendingEmailVerificationToken } = require("../utils/tokens");
const { newSecret, totpQrCode, verifyTotp, generateBackupCodes, hashBackupCode } = require("../utils/twoFactor");
const { generateLoginCode, hashLoginCode } = require("../utils/otp");
const { generateVerificationCode, hashVerificationCode } = require("../utils/emailVerification");
const { requireAuth } = require("../middleware/requireAuth");
const { sendWelcomeEmail, sendPasswordResetEmail, sendLoginCodeEmail, sendEmailVerificationCode } = require("../utils/email");

const router = express.Router();

// Real, not a placeholder -- verifying a Google-issued ID token needs the actual OAuth Client ID
// from Google Cloud Console (see ROADMAP.md) as the expected `audience`, or a forged token for a
// completely different Google app could otherwise pass verification.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client();

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

// Shared between /register's initial send and /verify-email/resend -- generates a real code,
// invalidates any earlier still-active one for this account first (same reasoning as
// /otp/request: an old code staying valid alongside a new one would just be a weaker, forgotten
// backup door), stores only its hash, and emails it.
async function issueEmailVerificationCode(user) {
  await query("DELETE FROM email_verification_codes WHERE user_id = $1 AND consumed = false", [user.id]);
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await query(
    "INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
    [user.id, hashVerificationCode(code), expiresAt]
  );
  sendEmailVerificationCode(user, code).catch((err) => console.error("Failed to send verification email:", err));
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!isPasswordStrongEnough(password)) return res.status(400).json({ error: "Password must be at least 6 characters, with at least one letter and one number." });
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
    "INSERT INTO users (email, name, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, false) RETURNING *",
    [cleanEmail, name.trim(), passwordHash, role]
  );
  const user = result.rows[0];
  // Real email verification -- a password-based registration is the one signup path where email
  // ownership genuinely hasn't been proven yet (Google verifies it itself; OTP/email-code signup
  // proves it by requiring a real code from that inbox before the account is even created). The
  // welcome email is deliberately deferred to /verify-email succeeding, not sent here -- welcoming
  // someone into an account they can't actually use yet would be premature and a confusing second
  // email right on top of the verification code they need to act on first.
  await issueEmailVerificationCode(user);
  res.status(201).json({ requiresEmailVerification: true, pendingToken: signPendingEmailVerificationToken(user) });
});

router.post("/verify-email", async (req, res) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || typeof pendingToken !== "string") {
    return res.status(400).json({ error: "Missing or invalid verification session. Please sign up or sign in again." });
  }

  let payload;
  try {
    payload = verifyPendingEmailVerificationToken(pendingToken);
  } catch {
    return res.status(401).json({ error: "That verification session has expired. Please sign in again to get a new code." });
  }

  const result = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "That verification session is no longer valid. Please sign in again." });
  if (user.email_verified) {
    // Already verified by the time this arrived (e.g. two tabs, or a retried request) -- treat
    // it as success rather than a confusing error, since the actual goal (a verified, signed-in
    // account) is already true.
    return res.json({ user: publicUser(user), token: signAccessToken(user) });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Enter the 6-digit code from your email." });
  }

  const codeResult = await query(
    "SELECT * FROM email_verification_codes WHERE user_id = $1 AND consumed = false ORDER BY created_at DESC LIMIT 1",
    [user.id]
  );
  const verificationCode = codeResult.rows[0];
  if (!verificationCode) return res.status(400).json({ error: "No active code for this account. Request a new one." });
  if (new Date(verificationCode.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "That code has expired. Request a new one." });
  }
  // Same 3-attempt lockout as /otp/verify, enforced the same way.
  if (verificationCode.attempts >= 3) {
    return res.status(400).json({ error: "Too many wrong attempts. Request a new code." });
  }

  if (hashVerificationCode(code) !== verificationCode.code_hash) {
    await query("UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1", [verificationCode.id]);
    return res.status(400).json({ error: "Incorrect code." });
  }

  // Consumed the moment it's confirmed correct, same principle as /otp/verify.
  await query("UPDATE email_verification_codes SET consumed = true WHERE id = $1", [verificationCode.id]);
  const updatedResult = await query("UPDATE users SET email_verified = true WHERE id = $1 RETURNING *", [user.id]);
  const verifiedUser = updatedResult.rows[0];

  // The welcome email genuinely belongs here now -- this is the actual moment the account
  // becomes usable, not registration itself.
  sendWelcomeEmail(verifiedUser).catch((err) => console.error("Failed to send welcome email:", err));

  if (verifiedUser.two_factor_enabled) {
    // Extremely unlikely in practice (2FA can only be enabled from inside a real, signed-in
    // session, which a never-verified account has never had) but handled correctly rather than
    // assumed impossible, same principle as everywhere else in this file that checks this flag.
    return res.json({ requiresTwoFactor: true, pendingToken: signPendingTwoFactorToken(verifiedUser) });
  }

  res.json({ user: publicUser(verifiedUser), token: signAccessToken(verifiedUser) });
});

router.post("/verify-email/resend", async (req, res) => {
  const { pendingToken } = req.body || {};
  if (!pendingToken || typeof pendingToken !== "string") {
    return res.status(400).json({ error: "Missing or invalid verification session. Please sign in again." });
  }

  let payload;
  try {
    payload = verifyPendingEmailVerificationToken(pendingToken);
  } catch {
    return res.status(401).json({ error: "That verification session has expired. Please sign in again to get a new code." });
  }

  const result = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "That verification session is no longer valid. Please sign in again." });
  if (!user.email_verified) await issueEmailVerificationCode(user);
  res.json({ message: "A new code has been sent." });
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

  if (!user.email_verified) {
    // Correct password, but this account was created via password registration and never
    // finished email verification -- same "right password, one more real step before a real
    // session token" shape as the 2FA branch just below, reusing the exact same pending-token
    // pattern. Genuinely possible: someone registers, closes the tab before entering the code,
    // and comes back later through a normal sign-in instead.
    await issueEmailVerificationCode(user);
    return res.json({ requiresEmailVerification: true, pendingToken: signPendingEmailVerificationToken(user) });
  }

  if (user.two_factor_enabled) {
    // Correct password alone isn't enough to sign in on an account with 2FA on. This is
    // deliberately NOT a real access token -- see signPendingTwoFactorToken's own comment for why
    // it can't be used to reach anything except finishing the challenge at /2fa/verify-login.
    return res.json({ requiresTwoFactor: true, pendingToken: signPendingTwoFactorToken(user) });
  }

  res.json({ user: publicUser(user), token: signAccessToken(user) });
});

// Real Google sign-in: verifies an ID token Google's own Sign-In button already produced entirely
// client-side (no authorization code, no client secret, no redirect dance -- the frontend calls
// this with a JWT Google itself signed, and all this route does is confirm Google really signed
// it and that it was actually issued for *this* app). Serves as both login and registration in
// one -- a matching email either signs into the existing account or creates a new one, same as
// the roadmap's own requirement that email+password and Google resolve to the same account.
router.post("/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    // Fails loudly rather than silently misbehaving -- same philosophy as VITE_API_URL's own
    // check on the frontend (src/utils/api.js). A missing config here shouldn't look like "Google
    // sign-in is broken" to a user; it should look like "not set up yet" to whoever runs this.
    console.error("GOOGLE_CLIENT_ID is not set — Google sign-in cannot be verified.");
    return res.status(503).json({ error: "Google sign-in isn't set up on this server yet." });
  }
  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({ error: "Missing Google credential." });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    // Deliberately vague to the client (same principle as "Invalid email or password" above) --
    // an expired token, a forged one, and a token issued for a different app all fail the same
    // way here, and none of those distinctions are useful or safe to expose.
    return res.status(401).json({ error: "Couldn't verify that Google sign-in. Please try again." });
  }

  if (!payload || !payload.email) {
    return res.status(401).json({ error: "That Google account doesn't have a usable email." });
  }
  if (!payload.email_verified) {
    return res.status(401).json({ error: "That Google account's email isn't verified yet. Verify it with Google first." });
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const result = await query("SELECT * FROM users WHERE email = $1", [cleanEmail]);
  let user = result.rows[0];

  if (!user) {
    // Same first-user-becomes-admin bootstrap as /register above -- Google sign-in is a real,
    // equal way to create the very first account on a fresh deployment, not a second-class path
    // that skips it.
    const countResult = await query("SELECT COUNT(*) AS count FROM users", []);
    const isFirstUser = parseInt(countResult.rows[0].count, 10) === 0;
    const role = isFirstUser ? "super_admin" : "customer";

    // `name` isn't in every real Google ID token (only given_name/family_name are guaranteed by
    // google-auth-library's own type definitions, even though `name` is usually present too) --
    // falls back to combining those, then to the email's local part, rather than ever storing an
    // empty name.
    const displayName = payload.name
      || [payload.given_name, payload.family_name].filter(Boolean).join(" ")
      || cleanEmail.split("@")[0];

    // A Google-only account still needs *some* password_hash (the column is NOT NULL, same as
    // every other account) -- a real, cryptographically random value that's never disclosed or
    // usable by anyone, not a predictable placeholder. This isn't a workaround so much as the
    // actually-correct state: an account created this way genuinely doesn't have a password yet,
    // and the already-real "forgot password" flow above is exactly how someone would set one
    // later if they want email+password as a second way in.
    const randomPasswordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
    const inserted = await query(
      // email_verified: true -- Google already verified this email itself (checked above via
      // payload.email_verified) before ever handing back a usable ID token.
      "INSERT INTO users (email, name, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, true) RETURNING *",
      [cleanEmail, displayName, randomPasswordHash, role]
    );
    user = inserted.rows[0];
    sendWelcomeEmail(user).catch((err) => console.error("Failed to send welcome email:", err));
  }

  if (user.two_factor_enabled) {
    // An account protected with 2FA stays protected regardless of which door someone signs in
    // through -- same branch, same reasoning as /login above.
    return res.json({ requiresTwoFactor: true, pendingToken: signPendingTwoFactorToken(user) });
  }

  res.json({ user: publicUser(user), token: signAccessToken(user) });
});

// Real OTP (email-code) sign-in: a genuine passwordless alternative to /login, not the old
// frontend simulation that generated a code locally and displayed it back on screen. Serves as
// both login and registration, same principle as /google -- a matching email signs into the
// existing account, a new email creates one, only once the code is actually verified (not at
// request time, so simply requesting a code for a random email never creates a real account).
router.post("/otp/request", async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

  const cleanEmail = email.trim().toLowerCase();
  const code = generateLoginCode();
  // Invalidates any earlier still-active code for this email first -- otherwise an old code from
  // a previous request would stay valid alongside the new one, and /otp/verify's "most recent"
  // lookup below would be the only thing standing between an attacker and a stale, weaker code.
  await query("DELETE FROM login_codes WHERE email = $1 AND consumed = false", [cleanEmail]);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes -- real email delivery has
  // real latency, unlike the old frontend simulation's 60-second local countdown, which assumed
  // the code was already on screen the instant it was "sent."
  await query(
    "INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)",
    [cleanEmail, hashLoginCode(code), expiresAt]
  );
  sendLoginCodeEmail(cleanEmail, code).catch((err) => console.error("Failed to send login code email:", err));
  // Same generic response regardless of anything about this email -- there's genuinely nothing to
  // differentiate on here (unlike password login), since this endpoint behaves identically whether
  // or not an account exists yet.
  res.json({ message: "If that's a real email address, a sign-in code has been sent." });
});

router.post("/otp/verify", async (req, res) => {
  const { email, code } = req.body || {};
  if (!isValidEmail(email) || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Enter your email and the 6-digit code." });
  }
  const cleanEmail = email.trim().toLowerCase();

  const result = await query(
    "SELECT * FROM login_codes WHERE email = $1 AND consumed = false ORDER BY created_at DESC LIMIT 1",
    [cleanEmail]
  );
  const loginCode = result.rows[0];
  if (!loginCode) return res.status(400).json({ error: "No active code for that email. Request a new one." });
  if (new Date(loginCode.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "That code has expired. Request a new one." });
  }
  // Mirrors the frontend's own pre-existing 3-attempt lockout UX, now actually enforced
  // server-side instead of just in client-side state that meant nothing on its own.
  if (loginCode.attempts >= 3) {
    return res.status(400).json({ error: "Too many wrong attempts. Request a new code." });
  }

  if (hashLoginCode(code) !== loginCode.code_hash) {
    await query("UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1", [loginCode.id]);
    return res.status(400).json({ error: "Incorrect code." });
  }

  // Consumed the moment it's confirmed correct -- whatever happens next (even an unexpected
  // error below), this exact code can never be used to sign in again.
  await query("UPDATE login_codes SET consumed = true WHERE id = $1", [loginCode.id]);

  let userResult = await query("SELECT * FROM users WHERE email = $1", [cleanEmail]);
  let user = userResult.rows[0];

  if (!user) {
    // Same first-user-becomes-admin bootstrap as /register and /google above.
    const countResult = await query("SELECT COUNT(*) AS count FROM users", []);
    const isFirstUser = parseInt(countResult.rows[0].count, 10) === 0;
    const role = isFirstUser ? "super_admin" : "customer";
    // Same reasoning as Google sign-in's account creation: a real, cryptographically random,
    // never-disclosed password_hash -- this account genuinely doesn't have a password yet, and
    // "forgot password" is exactly how someone would set one later if they want it.
    const randomPasswordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
    const inserted = await query(
      // email_verified: true -- successfully entering the real code just sent to this inbox
      // (checked above, before this account is even created) already proves ownership.
      "INSERT INTO users (email, name, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, true) RETURNING *",
      [cleanEmail, cleanEmail.split("@")[0], randomPasswordHash, role]
    );
    user = inserted.rows[0];
    sendWelcomeEmail(user).catch((err) => console.error("Failed to send welcome email:", err));
  }

  if (user.two_factor_enabled) {
    // Same reasoning as /login and /google above -- 2FA applies regardless of which door someone
    // signs in through.
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
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: "Password must be at least 6 characters, with at least one letter and one number." });

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