const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Same reasoning as feedback.js's own limiter -- genuinely public, unauthenticated, and a real
// visitor has no reason to submit more than a handful of times in 15 minutes.
const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again in a few minutes." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicSubscriber(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    source: row.source,
    unsubscribed: !!row.unsubscribed,
    date: createdAtIso ? createdAtIso.slice(0, 10) : null,
    createdAt: row.created_at,
  };
}

// Public, rate-limited rather than auth-gated -- same defense-in-depth choice feedback.js makes,
// for the same reason (no account exists to gate this behind; a real visitor filling out a
// footer form has never signed in at the point they do it).
router.post("/", newsletterLimiter, async (req, res) => {
  const { email, name, source } = req.body || {};

  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (name !== undefined && name !== null && (typeof name !== "string" || name.length > 120)) {
    return res.status(400).json({ error: "name must be 120 characters or fewer." });
  }
  const realSource = typeof source === "string" && source.length <= 40 ? source : "footer";

  // ON CONFLICT rather than a pre-check-then-insert -- someone signing up a second time with the
  // same email (a real, expected case, not an edge case) updates the existing row instead of
  // erroring or silently creating a duplicate the unique index would otherwise reject.
  const upserted = await query(
    `INSERT INTO newsletter_subscribers (email, name, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO UPDATE SET name = COALESCE(EXCLUDED.name, newsletter_subscribers.name), unsubscribed = false
     RETURNING *`,
    [email, name || null, realSource]
  );
  res.status(201).json({ subscriber: publicSubscriber(upserted.rows[0]) });
});

// Admin-only -- the real subscriber list, same permission-gating pattern as every other admin
// list route (requirePermission accepts either a real super_admin or a staff member specifically
// granted "Newsletter" access, matching the new ADMIN_SECTIONS entry).
router.get("/", requireAuth, requirePermission("Newsletter"), async (req, res) => {
  const result = await query("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC", []);
  res.json({ subscribers: result.rows.map(publicSubscriber) });
});

module.exports = router;
