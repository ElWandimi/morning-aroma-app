const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    // Fails loudly at startup/first-use rather than silently signing tokens with a weak or
    // missing secret — a short-circuiting mistake here would be a real security hole, not just a
    // bug, so this refuses to proceed instead of falling back to some default value.
    throw new Error("JWT_SECRET is missing or too short (need at least 32 characters). Set it in your environment before starting the server.");
  }
  return secret;
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    requireSecret(),
    { expiresIn: "7d" }
  );
}

// Issued after a correct password when the account has 2FA enabled -- proves "this request
// already supplied the right password" without yet being a real, usable session token. Deliberately
// a different shape (`type: "2fa_pending"`) and far shorter-lived (5 minutes, matching how long a
// person should reasonably take to open their authenticator app) than a real access token, and
// requireAuth (middleware/requireAuth.js) never accepts this type -- so it can't be used to reach
// any route except /auth/2fa/verify-login itself, even if it leaked somewhere in that 5-minute
// window.
function signPendingTwoFactorToken(user) {
  return jwt.sign(
    { sub: user.id, type: "2fa_pending" },
    requireSecret(),
    { expiresIn: "5m" }
  );
}

function verifyPendingTwoFactorToken(token) {
  const payload = jwt.verify(token, requireSecret());
  if (payload.type !== "2fa_pending") {
    // Never actually reachable via a normally-issued real access token today (they don't carry a
    // `type` claim at all), but explicit rather than assumed -- if a second short-lived token type
    // is ever added later, this stops it from silently also being accepted here.
    throw new Error("Not a valid 2FA session token.");
  }
  return payload;
}

// Same shape and reasoning as signPendingTwoFactorToken/verifyPendingTwoFactorToken above, for
// email verification instead -- proves "this request already supplied the right password (or
// completed Google/OTP)" without yet being a real, usable session token. Same 5-minute lifetime
// and same "wrong type is rejected outright" guard.
function signPendingEmailVerificationToken(user) {
  return jwt.sign(
    { sub: user.id, type: "email_verification_pending" },
    requireSecret(),
    { expiresIn: "5m" }
  );
}

function verifyPendingEmailVerificationToken(token) {
  const payload = jwt.verify(token, requireSecret());
  if (payload.type !== "email_verification_pending") {
    throw new Error("Not a valid email verification session token.");
  }
  return payload;
}

function verifyAccessToken(token) {
  return jwt.verify(token, requireSecret());
}

// Password reset tokens: generate a random raw token, return it to the caller (to email to the
// user), but only ever store its SHA-256 hash in the database — the same principle as never
// storing a plaintext password. If the database is ever compromised, the stored hashes alone
// can't be used to reset anyone's account.
function generateResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashResetToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = { signAccessToken, verifyAccessToken, generateResetToken, hashResetToken, signPendingTwoFactorToken, verifyPendingTwoFactorToken, signPendingEmailVerificationToken, verifyPendingEmailVerificationToken };
