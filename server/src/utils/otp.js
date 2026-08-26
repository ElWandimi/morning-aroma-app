const crypto = require("crypto");

// crypto.randomInt (cryptographically secure) rather than Math.random() (not) -- the old frontend
// simulation used Math.random() only because it never mattered for a fake, locally-compared demo
// code. A real login code is functionally a temporary password and deserves the same randomness
// guarantee a real password reset token already gets.
function generateLoginCode() {
  return String(crypto.randomInt(100000, 1000000)); // always 6 digits, 100000-999999
}

// Same principle as hashResetToken (utils/tokens.js): only ever store a hash, never the raw code.
function hashLoginCode(code) {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

module.exports = { generateLoginCode, hashLoginCode };
