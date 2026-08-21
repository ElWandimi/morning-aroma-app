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

module.exports = { signAccessToken, verifyAccessToken, generateResetToken, hashResetToken };
