const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Real, if lighter than auth's -- this is a much lower-risk action (no account takeover
// possible), but still a genuinely public, anonymous, unauthenticated endpoint, so still worth
// real spam protection. A real customer submitting a review has no reason to do it more than a
// handful of times in 15 minutes; a spam script would.
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again in a few minutes." },
});

function publicFeedback(row) {
  // row.created_at is a real JS Date object from production Postgres (via the pg driver), but a
  // plain string from the SQLite test adapter (SQLite has no native timestamp type) -- handling
  // both rather than assuming only the former, which is what actually crashed this the first time
  // the tests ran.
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    productId: row.product_id,
    rating: row.rating,
    aroma: row.aroma,
    texture: row.texture,
    tags: row.tags,
    note: row.note,
    reviewed: !!row.reviewed,
    date: createdAtIso ? createdAtIso.slice(0, 10) : null,
    createdAt: row.created_at,
  };
}

// Anonymous by design, matching the existing, established "Leave Your Aroma" UX (never asked for
// a name or login before this, and this migration doesn't change that) -- rate-limited, not
// auth-gated, as the real defense against abuse here.
router.post("/", feedbackLimiter, async (req, res) => {
  const { rating, aroma, texture, tags, productId, note } = req.body || {};

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be a whole number from 1 to 5." });
  if (!Number.isInteger(aroma) || aroma < 0 || aroma > 10) return res.status(400).json({ error: "aroma must be a whole number from 0 to 10." });
  if (!Number.isInteger(texture) || texture < 0 || texture > 10) return res.status(400).json({ error: "texture must be a whole number from 0 to 10." });
  if (tags !== undefined && !Array.isArray(tags)) return res.status(400).json({ error: "tags must be an array." });
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500)) return res.status(400).json({ error: "note must be 500 characters or fewer." });

  // "General feedback" (not tied to any one variety) is a real, existing option in the
  // submission form -- productId is genuinely optional, only validated against the real catalog
  // when actually provided.
  let realProductId = null;
  if (productId) {
    const productResult = await query("SELECT id FROM products WHERE id = $1", [productId]);
    if (!productResult.rows[0]) return res.status(400).json({ error: "That product doesn't exist." });
    realProductId = productId;
  }

  const inserted = await query(
    "INSERT INTO feedback (product_id, rating, aroma, texture, tags, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [realProductId, rating, aroma, texture, JSON.stringify(tags || []), note || null]
  );
  res.status(201).json({ feedback: publicFeedback(inserted.rows[0]) });
});

// Public -- a visitor needs to see real reviews for the product they're looking at without
// signing in, same reasoning as products/courses themselves being public. Only ever returns
// reviewed=true rows -- the real moderation gate, enforced here in the query itself, not just
// trusted to the frontend to filter correctly.
router.get("/product/:productId", async (req, res) => {
  const result = await query(
    "SELECT * FROM feedback WHERE product_id = $1 AND reviewed = true ORDER BY created_at DESC",
    [req.params.productId]
  );
  res.json({ feedback: result.rows.map(publicFeedback) });
});

// Admin-only, sees everything regardless of reviewed status -- this is the real moderation queue.
router.get("/", requireAuth, requirePermission("Feedback"), async (req, res) => {
  const result = await query("SELECT * FROM feedback ORDER BY created_at DESC", []);
  res.json({ feedback: result.rows.map(publicFeedback) });
});

router.patch("/:id/reviewed", requireAuth, requirePermission("Feedback"), async (req, res) => {
  const { reviewed } = req.body || {};
  if (typeof reviewed !== "boolean") return res.status(400).json({ error: "reviewed must be true or false." });
  const result = await query("UPDATE feedback SET reviewed = $1 WHERE id = $2 RETURNING *", [reviewed, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Feedback not found." });
  res.json({ feedback: publicFeedback(result.rows[0]) });
});

module.exports = router;
