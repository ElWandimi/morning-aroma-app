const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Requires at least one letter and one number, minimum 6 characters -- the actual source of truth
// for validation, not just a passthrough that trusts whatever the client sends. The frontend
// enforces the same rule and shows the same message, but this is what actually decides.
function isPasswordStrongEnough(plain) {
  if (typeof plain !== "string" || plain.length < 6) return false;
  return /[A-Za-z]/.test(plain) && /[0-9]/.test(plain);
}

module.exports = { hashPassword, verifyPassword, isPasswordStrongEnough };
