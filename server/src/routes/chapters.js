const express = require("express");
const { query } = require("../db");
const { requirePermission } = require("../middleware/requireAdmin");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

function publicChapter(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    number: row.number,
    title: row.title,
    description: row.description,
  };
}

function validateChapterInput(body, { partial } = {}) {
  const { title, description, number } = body || {};
  if (!partial || title !== undefined) {
    if (!title || typeof title !== "string" || !title.trim() || title.length > 200) return "A valid title is required.";
  }
  if (!partial || description !== undefined) {
    if (!description || typeof description !== "string" || !description.trim() || description.length > 800) return "A valid description is required.";
  }
  // number is always optional, on create and update alike -- omitted on create means "auto-assign
  // the next number in sequence" (see the POST handler below), so it's only validated when
  // actually provided, unlike title/description which are genuinely required on create.
  if (number !== undefined) {
    if (!Number.isInteger(number) || number < 1) return "Number must be a whole number, at least 1.";
  }
  return null;
}

// Public -- a course's real lesson list needs to be visible to any visitor browsing that course's
// page, same as the course itself; whether any *individual* lesson is unlocked for a given viewer
// (based on subscription/lifetime access) is a frontend concern (see CoursePage), not something
// this endpoint gates -- titles and descriptions aren't sensitive, only the actual lesson content
// (video, once that exists) would need real per-viewer access control.
router.get("/courses/:courseId/chapters", async (req, res) => {
  const result = await query("SELECT * FROM chapters WHERE course_id = $1 ORDER BY number ASC", [req.params.courseId]);
  res.json({ chapters: result.rows.map(publicChapter) });
});

router.post("/courses/:courseId/chapters", requireAuth, requirePermission("Content"), async (req, res) => {
  const { courseId } = req.params;
  const validationError = validateChapterInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const course = await query("SELECT id FROM courses WHERE id = $1", [courseId]);
  if (!course.rows[0]) return res.status(404).json({ error: "Course not found." });

  const { title, description, number } = req.body;
  // A chapter number left unspecified defaults to "one after the current last chapter" -- the
  // common case (adding the next lesson in sequence) shouldn't require calculating that yourself.
  let chapterNumber = number;
  if (chapterNumber === undefined) {
    const maxResult = await query("SELECT COALESCE(MAX(number), 0) AS max FROM chapters WHERE course_id = $1", [courseId]);
    chapterNumber = maxResult.rows[0].max + 1;
  }

  const id = `${courseId}-ch${chapterNumber}`;
  const existing = await query("SELECT id FROM chapters WHERE id = $1", [id]);
  if (existing.rows[0]) return res.status(409).json({ error: `Chapter ${chapterNumber} already exists for this course.` });

  const result = await query(
    "INSERT INTO chapters (id, course_id, number, title, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [id, courseId, chapterNumber, title.trim(), description.trim()]
  );
  res.status(201).json({ chapter: publicChapter(result.rows[0]) });
});

router.patch("/chapters/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const validationError = validateChapterInput(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = await query("SELECT * FROM chapters WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Chapter not found." });

  const current = existing.rows[0];
  const { title, description, number } = req.body;
  const result = await query(
    `UPDATE chapters SET title = $1, description = $2, number = $3, updated_at = now() WHERE id = $4 RETURNING *`,
    [
      title !== undefined ? title.trim() : current.title,
      description !== undefined ? description.trim() : current.description,
      number !== undefined ? number : current.number,
      id,
    ]
  );
  res.json({ chapter: publicChapter(result.rows[0]) });
});

router.delete("/chapters/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const result = await query("DELETE FROM chapters WHERE id = $1 RETURNING *", [id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Chapter not found." });
  res.json({ ok: true });
});

module.exports = router;
