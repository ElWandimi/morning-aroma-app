const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

// Kept in sync by hand with src/data/index.js's ADMIN_SECTIONS on the frontend (minus Overview,
// which every staff member gets regardless and was never a grantable permission to begin with).
// Validating against a real list here — rather than accepting any array of strings — means a
// malformed or malicious PATCH body can't silently store garbage in a real user's permissions
// column, even though an unrecognized value wouldn't actually grant access to anything on the
// frontend either way.
const VALID_PERMISSIONS = [
  "Analytics", "Orders", "Invoices", "Customers", "Products", "Inventory", "Content",
  "Quotations", "Service Inquiries", "Green Orders", "Live Chat", "Feedback", "Live Messages",
  "Audit Log", "Settings",
];
const VALID_ROLES = ["customer", "staff", "super_admin"];

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    twoFactorEnabled: row.two_factor_enabled,
    notificationsEnabled: row.notifications_enabled,
    createdAt: row.created_at,
  };
}

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const result = await query("SELECT * FROM users ORDER BY created_at ASC", []);
  res.json({ users: result.rows.map(publicUser) });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, permissions } = req.body || {};

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || !permissions.every((p) => VALID_PERMISSIONS.includes(p))) {
      return res.status(400).json({ error: "Permissions must be an array of valid admin section names." });
    }
  }

  const targetResult = await query("SELECT * FROM users WHERE id = $1", [id]);
  const target = targetResult.rows[0];
  if (!target) return res.status(404).json({ error: "No account found with that ID." });

  // Safety check: refuse to demote the last super_admin in the system, including an admin trying
  // to demote themselves. Without this, it's possible to lock every admin out of the dashboard
  // with no way back in short of a direct database edit -- a real, easy-to-trigger mistake (an
  // admin experimenting with their own account, or demoting the only other admin) rather than a
  // theoretical edge case.
  if (target.role === "super_admin" && role !== undefined && role !== "super_admin") {
    const adminCountResult = await query("SELECT COUNT(*) AS count FROM users WHERE role = $1", ["super_admin"]);
    if (parseInt(adminCountResult.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: "Can't remove the last remaining admin — promote someone else first." });
    }
  }

  const nextRole = role !== undefined ? role : target.role;
  // Staff can hold a specific permission set; any other role (customer, or freshly-promoted
  // super_admin) has permissions cleared, matching the frontend's own existing setRole behavior
  // for the demo data this replaces -- keeping the two consistent rather than letting the real
  // backend's rules quietly diverge from what the UI has always done.
  const nextPermissions = role !== undefined && role !== "staff"
    ? []
    : (permissions !== undefined ? permissions : target.permissions);

  const result = await query(
    "UPDATE users SET role = $1, permissions = $2 WHERE id = $3 RETURNING *",
    [nextRole, nextPermissions, id]
  );
  res.json({ user: publicUser(result.rows[0]) });
});

module.exports = router;
