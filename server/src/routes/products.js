const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

const VALID_TIERS = ["everyday", "premium"];

// Matches src/utils/helpers.js's slugify exactly -- generated product ids need to be identical
// to what the frontend would compute for the same name/country, since this id is what real
// orders, cart, and wishlist all reference going forward.
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function publicProduct(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    tier: row.tier,
    priceCents: row.price_cents,
    stock: row.stock,
    note: row.note,
    tags: row.tags,
    profile: row.profile,
    growing: row.growing,
    brewGuide: row.brew_guide,
    momentMatch: row.moment_match,
    course: row.course,
    photoUrl: row.photo_url,
  };
}

function validateProductInput(body, { partial } = {}) {
  const { name, country, tier, priceCents, stock } = body || {};
  if (!partial || name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim() || name.length > 200) return "A valid name is required.";
  }
  if (!partial || country !== undefined) {
    if (!country || typeof country !== "string" || !country.trim() || country.length > 200) return "A valid country is required.";
  }
  if (!partial || tier !== undefined) {
    if (!VALID_TIERS.includes(tier)) return `Tier must be one of: ${VALID_TIERS.join(", ")}`;
  }
  if (!partial || priceCents !== undefined) {
    if (!Number.isInteger(priceCents) || priceCents < 0) return "Price must be a whole number of cents, zero or greater.";
  }
  if (!partial || stock !== undefined) {
    if (!Number.isInteger(stock) || stock < 0) return "Stock must be a whole number, zero or greater.";
  }
  return null;
}

// Public -- customers need to browse the catalog without signing in. Excludes soft-deleted
// (discontinued) products, matching the existing frontend's getAllProducts() behavior.
router.get("/", async (req, res) => {
  const result = await query("SELECT * FROM products WHERE removed = false ORDER BY name ASC", []);
  res.json({ products: result.rows.map(publicProduct) });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const validationError = validateProductInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, country, tier, priceCents, stock, note, tags, profile, growing, brewGuide, momentMatch, course } = req.body;
  const id = slugify(`${name}-${country}`);

  const existing = await query("SELECT id FROM products WHERE id = $1", [id]);
  if (existing.rows.length > 0) return res.status(409).json({ error: "A product with this name and country already exists." });

  const result = await query(
    `INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [id, name.trim(), country.trim(), tier, priceCents, stock, note || null, JSON.stringify(tags || {}), JSON.stringify(profile || {}), growing || null, brewGuide || null, momentMatch || null, course || null]
  );
  res.status(201).json({ product: publicProduct(result.rows[0]) });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const validationError = validateProductInput(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "No product found with that ID." });
  const current = existing.rows[0];

  // Only the fields actually present in the request body get updated -- everything else keeps
  // its current value. Lets the same endpoint serve every admin edit (just a price, just a photo,
  // a full edit) without needing separate routes for each.
  const b = req.body;
  const next = {
    name: b.name !== undefined ? b.name.trim() : current.name,
    country: b.country !== undefined ? b.country.trim() : current.country,
    tier: b.tier !== undefined ? b.tier : current.tier,
    price_cents: b.priceCents !== undefined ? b.priceCents : current.price_cents,
    stock: b.stock !== undefined ? b.stock : current.stock,
    note: b.note !== undefined ? b.note : current.note,
    tags: b.tags !== undefined ? JSON.stringify(b.tags) : JSON.stringify(current.tags),
    profile: b.profile !== undefined ? JSON.stringify(b.profile) : JSON.stringify(current.profile),
    growing: b.growing !== undefined ? b.growing : current.growing,
    brew_guide: b.brewGuide !== undefined ? b.brewGuide : current.brew_guide,
    moment_match: b.momentMatch !== undefined ? b.momentMatch : current.moment_match,
    course: b.course !== undefined ? b.course : current.course,
    photo_url: b.photoUrl !== undefined ? b.photoUrl : current.photo_url,
  };

  const result = await query(
    `UPDATE products SET name = $1, country = $2, tier = $3, price_cents = $4, stock = $5, note = $6,
       tags = $7, profile = $8, growing = $9, brew_guide = $10, moment_match = $11, course = $12,
       photo_url = $13, updated_at = now()
     WHERE id = $14 RETURNING *`,
    [next.name, next.country, next.tier, next.price_cents, next.stock, next.note, next.tags, next.profile, next.growing, next.brew_guide, next.moment_match, next.course, next.photo_url, req.params.id]
  );
  res.json({ product: publicProduct(result.rows[0]) });
});

// Soft delete, matching the existing "discontinued item" behavior already built on the frontend
// (Journey.jsx shows a "Discontinued item" fallback for order history referencing a removed
// product) -- a real order that referenced this product by id needs the id to keep existing.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await query("UPDATE products SET removed = true, updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "No product found with that ID." });
  res.json({ ok: true });
});

module.exports = router;
