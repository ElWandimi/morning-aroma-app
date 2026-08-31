const express = require("express");
const { query } = require("../db");
const { requirePermission } = require("../middleware/requireAdmin");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// Matches src/utils/helpers.js's slugify exactly -- generated course ids need to be identical to
// what the frontend would compute for the same name, since this id is what real subscriptions
// (and the course's own URL) reference going forward.
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Real annual price is always derived here, at 20% off 12 months, never stored separately -- so
// it can never silently drift out of sync with the monthly price it's based on.
function annualPriceCents(monthlyPriceCents) {
  return Math.round(monthlyPriceCents * 12 * 0.8);
}

function publicCourse(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    blurb: row.blurb,
    instructor: row.instructor,
    lessons: row.lessons,
    monthlyPriceCents: row.monthly_price_cents,
    annualPriceCents: annualPriceCents(row.monthly_price_cents),
  };
}

function validateCourseInput(body, { partial } = {}) {
  const { name, category, blurb, instructor, lessons, monthlyPriceCents } = body || {};
  if (!partial || name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim() || name.length > 200) return "A valid name is required.";
  }
  if (!partial || category !== undefined) {
    if (!category || typeof category !== "string" || !category.trim() || category.length > 100) return "A valid category is required.";
  }
  if (!partial || blurb !== undefined) {
    if (!blurb || typeof blurb !== "string" || !blurb.trim() || blurb.length > 500) return "A valid blurb is required.";
  }
  if (!partial || instructor !== undefined) {
    if (!instructor || typeof instructor !== "string" || !instructor.trim() || instructor.length > 200) return "A valid instructor is required.";
  }
  if (!partial || lessons !== undefined) {
    if (!Number.isInteger(lessons) || lessons < 1) return "Lessons must be a whole number, at least 1.";
  }
  if (!partial || monthlyPriceCents !== undefined) {
    if (!Number.isInteger(monthlyPriceCents) || monthlyPriceCents < 0) return "Monthly price must be a whole number of cents, zero or greater.";
  }
  return null;
}

// Public -- customers need to browse the catalog without signing in, same reasoning as products.
router.get("/", async (req, res) => {
  const result = await query("SELECT * FROM courses WHERE removed = false ORDER BY name ASC", []);
  res.json({ courses: result.rows.map(publicCourse) });
});

router.post("/", requireAuth, requirePermission("Content"), async (req, res) => {
  const validationError = validateCourseInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { name, category, blurb, instructor, lessons, monthlyPriceCents } = req.body;
  const id = slugify(name);

  const existing = await query("SELECT id FROM courses WHERE id = $1", [id]);
  if (existing.rows[0]) return res.status(409).json({ error: "A course with this name already exists." });

  const result = await query(
    "INSERT INTO courses (id, name, category, blurb, instructor, lessons, monthly_price_cents) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    [id, name.trim(), category.trim(), blurb.trim(), instructor.trim(), lessons, monthlyPriceCents]
  );
  res.status(201).json({ course: publicCourse(result.rows[0]) });
});

router.patch("/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const validationError = validateCourseInput(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = await query("SELECT * FROM courses WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Course not found." });

  const current = existing.rows[0];
  const { name, category, blurb, instructor, lessons, monthlyPriceCents } = req.body;
  const result = await query(
    `UPDATE courses SET name = $1, category = $2, blurb = $3, instructor = $4, lessons = $5, monthly_price_cents = $6, updated_at = now()
     WHERE id = $7 RETURNING *`,
    [
      name !== undefined ? name.trim() : current.name,
      category !== undefined ? category.trim() : current.category,
      blurb !== undefined ? blurb.trim() : current.blurb,
      instructor !== undefined ? instructor.trim() : current.instructor,
      lessons !== undefined ? lessons : current.lessons,
      monthlyPriceCents !== undefined ? monthlyPriceCents : current.monthly_price_cents,
      id,
    ]
  );
  res.json({ course: publicCourse(result.rows[0]) });
});

router.delete("/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const result = await query("UPDATE courses SET removed = true, updated_at = now() WHERE id = $1 RETURNING *", [id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Course not found." });
  res.json({ course: publicCourse(result.rows[0]) });
});

module.exports = router;
