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

// Same up-to-the-second freshness reasoning as requireAdmin above, but for routes a granted staff
// member should genuinely be able to reach too -- not just super_admin. Previously, EVERY route
// across the whole backend used requireAdmin alone, meaning the staff-permissions feature
// (src/data/index.js's STAFF_PERMISSIONS, granted via the Customers section's checkboxes) was
// cosmetic only: a staff member granted "Inventory" access, for example, would see the real panel
// and every button in it, then get a real 403 on literally every action, every time, since nothing
// server-side ever checked what they'd actually been granted -- only whether they were
// super_admin. Accepts either a real super_admin, or a staff member whose stored permissions
// include at least one of the names passed in -- e.g. requirePermission("Products", "Inventory")
// on the products routes, since that one underlying resource is legitimately reachable from
// either frontend section.
//
// Deliberately NOT used for /users -- role and permission management is the one place a
// safe subset genuinely doesn't exist: granting a staff member "Customers" access to that exact
// endpoint would let them change roles and permissions, including their own, which is a real
// privilege-escalation path, not a UI nicety. /users stays on requireAdmin (super_admin only),
// unconditionally, regardless of what any staff member has been granted elsewhere.
function requirePermission(...allowedPermissions) {
  return async (req, res, next) => {
    const result = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
    const currentUser = result.rows[0];
    const hasAccess = currentUser && (
      currentUser.role === "super_admin" ||
      (currentUser.role === "staff" && (currentUser.permissions || []).some((p) => allowedPermissions.includes(p)))
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "You don't have access to this." });
    }
    req.user = currentUser;
    next();
  };
}

module.exports = { requireAdmin, requirePermission };
