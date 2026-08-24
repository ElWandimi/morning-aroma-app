const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

// Matches src/utils/helpers.js's slugify exactly, same reasoning as products.js -- generated ids
// need to be identical to what the frontend would compute for the same name/country.
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function publicGreenBean(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    roastedId: row.roasted_id,
    pricePerKgCents: row.price_per_kg_cents,
    stockKg: row.stock_kg,
    minOrderKg: row.min_order_kg,
    cuppingScore: row.cupping_score,
    moisture: row.moisture,
    grade: row.grade,
    process: row.process,
    notes: row.notes,
  };
}

function validateGreenBeanInput(body, { partial } = {}) {
  const { name, country, pricePerKgCents, stockKg, minOrderKg } = body || {};
  if (!partial || name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim() || name.length > 200) return "A valid name is required.";
  }
  if (!partial || country !== undefined) {
    if (!country || typeof country !== "string" || !country.trim() || country.length > 200) return "A valid country is required.";
  }
  if (!partial || pricePerKgCents !== undefined) {
    if (!Number.isInteger(pricePerKgCents) || pricePerKgCents <= 0) return "Price per kg must be a positive whole number of cents.";
  }
  if (!partial || stockKg !== undefined) {
    if (!Number.isInteger(stockKg) || stockKg < 0) return "Stock must be a whole number of kg, zero or greater.";
  }
  if (!partial || minOrderKg !== undefined) {
    if (!Number.isInteger(minOrderKg) || minOrderKg <= 0) return "Minimum order must be a positive whole number of kg.";
  }
  // Matches the frontend's existing validation rule (AdminInventory's green bean form) --
  // enforced here too now that this can be reached directly via the API, not just that form.
  const effectiveStock = stockKg !== undefined ? stockKg : body.__currentStockKg;
  const effectiveMinOrder = minOrderKg !== undefined ? minOrderKg : body.__currentMinOrderKg;
  if (effectiveStock != null && effectiveMinOrder != null && effectiveMinOrder > effectiveStock) {
    return "Minimum order can't exceed available stock.";
  }
  return null;
}

// Public -- wholesale buyers browse the Green Coffee page without signing in, same reasoning as
// GET /products. Excludes soft-deleted (discontinued) lots.
router.get("/", async (req, res) => {
  const result = await query("SELECT * FROM green_beans WHERE removed = false ORDER BY name ASC", []);
  res.json({ greenBeans: result.rows.map(publicGreenBean) });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const validationError = validateGreenBeanInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, country, roastedId, pricePerKgCents, stockKg, minOrderKg, cuppingScore, moisture, grade, process, notes } = req.body;
  const id = `green-${slugify(`${name}-${country}`)}`;

  const existing = await query("SELECT id FROM green_beans WHERE id = $1", [id]);
  if (existing.rows.length > 0) return res.status(409).json({ error: "A green coffee lot with this name and country already exists." });

  const result = await query(
    `INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [id, name.trim(), country.trim(), roastedId || null, pricePerKgCents, stockKg, minOrderKg, cuppingScore ?? null, moisture || null, grade || null, process || null, notes || null]
  );
  res.status(201).json({ greenBean: publicGreenBean(result.rows[0]) });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await query("SELECT * FROM green_beans WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "No green coffee lot found with that ID." });
  const current = existing.rows[0];

  // Cross-field validation (min order vs stock) needs both values even when only one is being
  // changed in this request -- passes the other's current value through so a price-only or
  // stock-only update still gets checked against the real, current state, not an undefined one.
  const validationError = validateGreenBeanInput(
    { ...req.body, __currentStockKg: current.stock_kg, __currentMinOrderKg: current.min_order_kg },
    { partial: true }
  );
  if (validationError) return res.status(400).json({ error: validationError });

  const b = req.body;
  const next = {
    name: b.name !== undefined ? b.name.trim() : current.name,
    country: b.country !== undefined ? b.country.trim() : current.country,
    roasted_id: b.roastedId !== undefined ? b.roastedId : current.roasted_id,
    price_per_kg_cents: b.pricePerKgCents !== undefined ? b.pricePerKgCents : current.price_per_kg_cents,
    stock_kg: b.stockKg !== undefined ? b.stockKg : current.stock_kg,
    min_order_kg: b.minOrderKg !== undefined ? b.minOrderKg : current.min_order_kg,
    cupping_score: b.cuppingScore !== undefined ? b.cuppingScore : current.cupping_score,
    moisture: b.moisture !== undefined ? b.moisture : current.moisture,
    grade: b.grade !== undefined ? b.grade : current.grade,
    process: b.process !== undefined ? b.process : current.process,
    notes: b.notes !== undefined ? b.notes : current.notes,
  };

  const result = await query(
    `UPDATE green_beans SET name = $1, country = $2, roasted_id = $3, price_per_kg_cents = $4, stock_kg = $5,
       min_order_kg = $6, cupping_score = $7, moisture = $8, grade = $9, process = $10, notes = $11, updated_at = now()
     WHERE id = $12 RETURNING *`,
    [next.name, next.country, next.roasted_id, next.price_per_kg_cents, next.stock_kg, next.min_order_kg, next.cupping_score, next.moisture, next.grade, next.process, next.notes, req.params.id]
  );
  res.json({ greenBean: publicGreenBean(result.rows[0]) });
});

// Soft delete, matching products.js's DELETE /:id exactly -- a real green order that referenced
// this lot by id needs the id to keep existing.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await query("UPDATE green_beans SET removed = true, updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "No green coffee lot found with that ID." });
  res.json({ ok: true });
});

module.exports = router;
