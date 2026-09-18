const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Same real reasoning as feedback.js/careerApplications.js's own limiters -- a genuinely public,
// anonymous, unauthenticated endpoint, still worth real spam protection.
const quotationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

const VALID_VARIETIES = ["Premium", "Everyday", "Not sure yet"];

function publicQuotation(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    variety: row.variety,
    quantity: row.quantity,
    message: row.message,
    status: row.status,
    date: createdAtIso.slice(0, 10),
    createdAt: createdAtIso,
  };
}

router.post("/", quotationLimiter, async (req, res) => {
  const { name, email, variety, quantity, message } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name is required (max 120 characters)." });
  if (typeof email !== "string" || !email.trim() || email.length > 254) return res.status(400).json({ error: "email is required (max 254 characters)." });
  if (!VALID_VARIETIES.includes(variety)) return res.status(400).json({ error: `variety must be one of: ${VALID_VARIETIES.join(", ")}` });
  if (quantity !== undefined && quantity !== null && (typeof quantity !== "string" || quantity.length > 60)) return res.status(400).json({ error: "quantity must be 60 characters or fewer." });
  if (message !== undefined && message !== null && (typeof message !== "string" || message.length > 1000)) return res.status(400).json({ error: "message must be 1000 characters or fewer." });

  const inserted = await query(
    "INSERT INTO quotations (name, email, variety, quantity, message) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [name.trim(), email.trim(), variety, quantity?.trim() || null, message?.trim() || null]
  );
  res.status(201).json({ quotation: publicQuotation(inserted.rows[0]) });
});

router.get("/", requireAuth, requirePermission("Quotations"), async (req, res) => {
  const result = await query("SELECT * FROM quotations ORDER BY created_at DESC", []);
  res.json({ quotations: result.rows.map(publicQuotation) });
});

router.patch("/:id/status", requireAuth, requirePermission("Quotations"), async (req, res) => {
  const { status } = req.body || {};
  if (!["New", "Contacted", "Closed"].includes(status)) return res.status(400).json({ error: 'status must be "New", "Contacted", or "Closed".' });
  const result = await query("UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Quotation not found." });
  res.json({ quotation: publicQuotation(result.rows[0]) });
});

module.exports = router;
