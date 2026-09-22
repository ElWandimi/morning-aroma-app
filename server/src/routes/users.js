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
//
// A real, confirmed bug this hand-sync already produced once: "Blog" and "Career Applications"
// were added to ADMIN_SECTIONS on the frontend when those features shipped, but this list wasn't
// updated at the same time -- the staff-permissions UI (src/admin/index.jsx's own
// STAFF_PERMISSIONS, which iterates ADMIN_SECTIONS directly) genuinely rendered real, clickable
// checkboxes for both, but checking either one and saving would silently fail this validation
// with an opaque 400, since neither string existed here yet. Every one of this session's own
// tests used a super_admin session, which bypasses this check entirely (see
// middleware/requireAdmin.js), so nothing caught it until a real, direct audit of every
// permission string across both real lists. When adding a new admin section in the future: it
// needs to land in BOTH lists in the same change, not just ADMIN_SECTIONS.
const VALID_PERMISSIONS = [
  "Analytics", "Orders", "Invoices", "Customers", "Products", "Inventory", "Content", "Blog",
  "Quotations", "Service Inquiries", "Green Orders", "Live Chat", "Feedback", "Newsletter",
  "Career Applications", "Live Messages", "Audit Log", "Settings",
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
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  // Excludes soft-deleted accounts (migrations/028_soft_delete_account.sql) by default -- an
  // account someone deleted themselves shouldn't keep showing up as an active customer in the
  // admin dashboard's Customers list or its "customers" count on Overview. The row itself, and
  // any real order/subscription history referencing it, is untouched; this is purely a display
  // filter on the one endpoint the dashboard reads from, not a data change. includeDeleted=true
  // (an explicit, deliberate opt-in a future "show deleted accounts" admin view could pass) skips
  // the filter entirely -- there's no separate "list only the deleted ones" mode yet since
  // nothing calls this route that way today, but the same query param could trivially grow one.
  const includeDeleted = req.query.includeDeleted === "true";
  const result = includeDeleted
    ? await query("SELECT * FROM users ORDER BY created_at ASC", [])
    : await query("SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC", []);
  res.json({ users: result.rows.map(publicUser) });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, permissions, emailVerified } = req.body || {};

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || !permissions.every((p) => VALID_PERMISSIONS.includes(p))) {
      return res.status(400).json({ error: "Permissions must be an array of valid admin section names." });
    }
  }
  if (emailVerified !== undefined && typeof emailVerified !== "boolean") {
    return res.status(400).json({ error: "emailVerified must be true or false." });
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

  const nextEmailVerified = emailVerified !== undefined ? emailVerified : target.email_verified;

  const result = await query(
    "UPDATE users SET role = $1, permissions = $2, email_verified = $3 WHERE id = $4 RETURNING *",
    [nextRole, nextPermissions, nextEmailVerified, id]
  );
  res.json({ user: publicUser(result.rows[0]) });
});

// Admin-side restore for a self-service-deleted account (migrations/028_soft_delete_account.sql,
// POST /auth/me/delete) -- the one intended way to reverse a soft delete, since there's no admin
// UI wired to it yet and support/the account owner asking directly is the realistic path this
// covers today. Clears deleted_at only; role/permissions/name/password are left exactly as they
// were at the moment of deletion (unlike the deliberate reset resurrectDeletedAccount performs
// when someone registers a NEW account under a previously-deleted email -- a genuinely different
// scenario: this route is "give the same person their same account back," not "let a fresh
// signup happen to land on this row").
router.post("/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await query(
    "UPDATE users SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *",
    [id]
  );
  if (result.rows.length === 0) {
    // Either no such user, or the user exists but isn't currently deleted -- both real,
    // legitimate reasons this could be called (a stale admin UI, a double click), not a case
    // worth distinguishing from the caller's perspective.
    return res.status(404).json({ error: "No deleted account found with that ID." });
  }
  res.json({ user: publicUser(result.rows[0]) });
});

module.exports = router;
