const crypto = require("crypto");

// Same reasoning and same real cryptographic randomness as utils/otp.js's generateLoginCode --
// a verification code is functionally a temporary credential and deserves the same guarantee a
// real password reset token or login code already gets, not Math.random().
function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000)); // always 6 digits, 100000-999999
}

// Same principle as hashResetToken/hashLoginCode: only ever store a hash, never the raw code.
function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

module.exports = { generateVerificationCode, hashVerificationCode };
