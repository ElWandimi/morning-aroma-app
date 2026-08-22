const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { hashPassword, verifyPassword, isPasswordStrongEnough } = require("../utils/password");
const { signAccessToken, generateResetToken, hashResetToken } = require("../utils/tokens");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// A dummy hash to compare against when a login's email isn't found — bcrypt.compare takes
// roughly the same time whether it matches or not, so running it even on a "no such user" path
// keeps the response timing consistent between "wrong password" and "no such account", rather
// than letting an attacker distinguish the two just by how fast the response comes back.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0eNwUeIB0ByLA4x/LurpKMoY2rrRj5G";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
    twoFactorEnabled: row.two_factor_enabled,
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

    // TODO(Tier 2 — real email delivery): this is where the raw token should be emailed to the
    // user as a reset link, e.g. https://morningaroma.com/#/reset-password?token=<raw>. No email
    // provider is wired up yet (see ROADMAP.md). Logging it server-side only, and only outside
    // production, so this endpoint is genuinely testable end-to-end right now without silently
    // pretending an email went out.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev only] Password reset token for ${email}: ${raw}`);
    }
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

module.exports = router;
