const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

function publicEntry(row) {
  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: row.id,
    actor: row.actor_email,
    action: row.action,
    detail: row.detail,
    timestamp: createdAt.toISOString(),
  };
}

// Gated by requireAuth alone, deliberately NOT requirePermission("Audit Log") -- every admin
// action across the whole dashboard (pricing, content, settings, quiz questions, and so on) needs
// to be able to write a log entry for ITSELF, regardless of which specific permission the actor
// holds. "Audit Log" is a real permission, but it gates who can VIEW the log below, not who can
// ever add to it -- the same way a store's own CCTV records every till, not just the till a
// manager happens to be watching.
router.post("/", requireAuth, async (req, res) => {
  const { action, detail } = req.body || {};
  if (typeof action !== "string" || !action.trim()) return res.status(400).json({ error: "action is required." });
  if (detail !== undefined && typeof detail !== "string") return res.status(400).json({ error: "detail must be a string." });

  const inserted = await query(
    "INSERT INTO admin_audit_log (actor_email, action, detail) VALUES ($1, $2, $3) RETURNING *",
    [req.user.email, action.trim(), detail || ""]
  );
  res.status(201).json({ entry: publicEntry(inserted.rows[0]) });
});

// Real permission gate on the READ side -- matches the existing "Audit Log" admin section, which
// a staff member only sees/reaches if specifically granted that permission (or is super_admin).
// Capped at the 200 most recent entries, the same real cap the old client-only state enforced,
// rather than returning this table's full, ever-growing history on every page load.
router.get("/", requireAuth, requirePermission("Audit Log"), async (req, res) => {
  const result = await query("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 200", []);
  res.json({ entries: result.rows.map(publicEntry) });
});

module.exports = router;
