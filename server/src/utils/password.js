const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Same minimum this project's frontend already enforces on signup forms elsewhere — kept here so
// the backend is the actual source of truth for validation, not just a passthrough that trusts
// whatever the client sends.
function isPasswordStrongEnough(plain) {
  return typeof plain === "string" && plain.length >= 8;
}

module.exports = { hashPassword, verifyPassword, isPasswordStrongEnough };
