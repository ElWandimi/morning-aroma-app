const express = require("express");
const { query } = require("../db");
const { requirePermission } = require("../middleware/requireAdmin");
const { requireAuth } = require("../middleware/requireAuth");
const { hasCourseAccessForChapter } = require("./quizzes");

const router = express.Router();

function publicChapter(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    number: row.number,
    title: row.title,
    description: row.description,
    objectives: row.objectives || [],
  };
}

function validateChapterInput(body, { partial } = {}) {
  const { title, description, number, objectives } = body || {};
  if (!partial || title !== undefined) {
    if (!title || typeof title !== "string" || !title.trim() || title.length > 200) return "A valid title is required.";
  }
  if (!partial || description !== undefined) {
    if (!description || typeof description !== "string" || !description.trim() || description.length > 800) return "A valid description is required.";
  }
  if (objectives !== undefined) {
    if (!Array.isArray(objectives) || objectives.some((o) => typeof o !== "string")) {
      return "objectives must be an array of strings.";
    }
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

// Real, access-gated lesson content -- unlike title/description (public, effectively marketing
// copy for the course), the full lesson body is the actual paid product, so this requires the
// same real subscription/lifetime-access check quizzes.js already established, not just the
// visible lock icon the frontend shows.
router.get("/chapters/:id/content", requireAuth, async (req, res) => {
  const { id } = req.params;
  const allowed = await hasCourseAccessForChapter(req.user.sub, id);
  if (!allowed) return res.status(403).json({ error: "You need an active subscription or lifetime access to download this lesson." });

  const result = await query("SELECT title, content FROM chapters WHERE id = $1", [id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Chapter not found." });
  if (!result.rows[0].content) return res.status(404).json({ error: "This lesson doesn't have downloadable content yet." });

  res.json({ title: result.rows[0].title, content: result.rows[0].content });
});

// Admin view of a chapter's full content -- deliberately separate from the customer-facing route
// above, and gated on Content permission rather than subscription/lifetime access. Staff managing
// lesson content shouldn't need to personally subscribe to a course to edit its text.
router.get("/admin/chapters/:id/content", requireAuth, requirePermission("Content"), async (req, res) => {
  const result = await query("SELECT title, content FROM chapters WHERE id = $1", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Chapter not found." });
  res.json({ title: result.rows[0].title, content: result.rows[0].content || "" });
});

router.post("/courses/:courseId/chapters", requireAuth, requirePermission("Content"), async (req, res) => {
  const { courseId } = req.params;
  const validationError = validateChapterInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const course = await query("SELECT id FROM courses WHERE id = $1", [courseId]);
  if (!course.rows[0]) return res.status(404).json({ error: "Course not found." });

  const { title, description, number, objectives } = req.body;
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
    "INSERT INTO chapters (id, course_id, number, title, description, objectives) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [id, courseId, chapterNumber, title.trim(), description.trim(), objectives || null]
  );
  res.status(201).json({ chapter: publicChapter(result.rows[0]) });
});

router.patch("/chapters/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const validationError = validateChapterInput(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });
  if (req.body.content !== undefined && typeof req.body.content !== "string") {
    return res.status(400).json({ error: "content must be a string." });
  }

  const existing = await query("SELECT * FROM chapters WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Chapter not found." });

  const current = existing.rows[0];
  const { title, description, number, content, objectives } = req.body;
  const result = await query(
    `UPDATE chapters SET title = $1, description = $2, number = $3, content = $4, objectives = $5, updated_at = now() WHERE id = $6 RETURNING *`,
    [
      title !== undefined ? title.trim() : current.title,
      description !== undefined ? description.trim() : current.description,
      number !== undefined ? number : current.number,
      content !== undefined ? content.trim() : current.content,
      objectives !== undefined ? objectives : current.objectives,
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
