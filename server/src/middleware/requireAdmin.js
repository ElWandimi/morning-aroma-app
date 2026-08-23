const { query } = require("../db");

// Stacks on top of requireAuth (mount requireAuth first). Unlike requireAuth's own req.user,
// which trusts the JWT's embedded role and can be stale until the user's next login (see
// requireAuth.js's own comment on this), user-management endpoints need up-to-the-second
// correctness -- if an admin's access is revoked, that must take effect on their very next
// request, not whenever they happen to log in again. Re-queries the current role from the
// database on every request rather than trusting the token, and replaces req.user with the fresh
// row so route handlers always see the real, current state.
async function requireAdmin(req, res, next) {
  const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const currentUser = result.rows[0];
  if (!currentUser || currentUser.role !== "super_admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  req.user = currentUser;
  next();
}

module.exports = { requireAdmin };
