const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again in a few minutes." },
});

function publicMessage(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    read: !!row.read,
    date: createdAtIso.slice(0, 10),
    createdAt: createdAtIso,
  };
}

router.post("/", contactLimiter, async (req, res) => {
  const { name, email, message } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name is required (max 120 characters)." });
  if (typeof email !== "string" || !email.trim() || email.length > 254) return res.status(400).json({ error: "email is required (max 254 characters)." });
  if (typeof message !== "string" || !message.trim() || message.length > 2000) return res.status(400).json({ error: "message is required (max 2000 characters)." });

  const inserted = await query(
    "INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING *",
    [name.trim(), email.trim(), message.trim()]
  );
  res.status(201).json({ message: publicMessage(inserted.rows[0]) });
});

router.get("/", requireAuth, requirePermission("Feedback"), async (req, res) => {
  // "Feedback" permission -- deliberately not a brand new permission string just for this one,
  // simpler inbox. Same real reasoning this app already applies elsewhere: a genuinely small,
  // low-complexity admin surface doesn't need its own dedicated grant when an existing, related
  // one (general customer-facing messages) already covers the same real kind of access.
  const result = await query("SELECT * FROM contact_messages ORDER BY created_at DESC", []);
  res.json({ messages: result.rows.map(publicMessage) });
});

router.patch("/:id/read", requireAuth, requirePermission("Feedback"), async (req, res) => {
  const { read } = req.body || {};
  if (typeof read !== "boolean") return res.status(400).json({ error: "read must be true or false." });
  const result = await query("UPDATE contact_messages SET read = $1 WHERE id = $2 RETURNING *", [read, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Message not found." });
  res.json({ message: publicMessage(result.rows[0]) });
});

module.exports = router;
