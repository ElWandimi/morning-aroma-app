const express = require("express");
const { query } = require("../db");
const { requirePermission } = require("../middleware/requireAdmin");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// Real access check, not a cosmetic frontend lock -- mirrors CoursePage's own hasAccess logic
// (hasLifetimeAccess || an active/paused subscription to this specific course) exactly, so a
// quiz can never be fetched or submitted by someone who wouldn't actually see that lesson
// unlocked in the UI. A non-existent chapter/course resolves to false, not an error, since the
// caller (routes below) already 404s separately for that case.
async function hasCourseAccessForChapter(userId, chapterId) {
  const chapterResult = await query("SELECT course_id FROM chapters WHERE id = $1", [chapterId]);
  const courseId = chapterResult.rows[0] && chapterResult.rows[0].course_id;
  if (!courseId) return false;

  const lifetime = await query("SELECT 1 FROM academy_lifetime_access WHERE user_id = $1", [userId]);
  if (lifetime.rows[0]) return true;

  const sub = await query(
    "SELECT 1 FROM subscriptions WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'paused')",
    [userId, courseId]
  );
  return !!sub.rows[0];
}

function publicQuestionForTaking(row) {
  // Deliberately omits correct_index and explanation -- those are only ever sent back after a
  // real submission is scored server-side (see the /submit route below), never alongside the
  // question itself, or a visitor could just read them out of the network response.
  return { id: row.id, number: row.number, question: row.question, options: row.options };
}

// Public existence check only -- whether a chapter's quiz has any questions at all is not
// sensitive (same reasoning chapter titles/descriptions are public in chapters.js), but the real
// question content requires real access, checked separately in the two routes below.
router.get("/chapters/:chapterId/quiz/exists", async (req, res) => {
  const result = await query("SELECT COUNT(*) AS count FROM quiz_questions WHERE chapter_id = $1", [req.params.chapterId]);
  res.json({ exists: Number(result.rows[0].count) > 0 });
});

router.get("/chapters/:chapterId/quiz", requireAuth, async (req, res) => {
  const { chapterId } = req.params;
  const allowed = await hasCourseAccessForChapter(req.user.sub, chapterId);
  if (!allowed) return res.status(403).json({ error: "You need an active subscription or lifetime access to take this quiz." });

  const result = await query("SELECT * FROM quiz_questions WHERE chapter_id = $1 ORDER BY number ASC", [chapterId]);
  res.json({ questions: result.rows.map(publicQuestionForTaking) });
});

router.post("/chapters/:chapterId/quiz/submit", requireAuth, async (req, res) => {
  const { chapterId } = req.params;
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).json({ error: "answers must be an array of selected option indices." });

  const allowed = await hasCourseAccessForChapter(req.user.sub, chapterId);
  if (!allowed) return res.status(403).json({ error: "You need an active subscription or lifetime access to take this quiz." });

  const result = await query("SELECT * FROM quiz_questions WHERE chapter_id = $1 ORDER BY number ASC", [chapterId]);
  const questions = result.rows;
  if (questions.length === 0) return res.status(404).json({ error: "This lesson doesn't have a quiz yet." });
  if (answers.length !== questions.length) {
    return res.status(400).json({ error: `Expected ${questions.length} answers, got ${answers.length}.` });
  }

  // Scored here, from the real stored correct_index -- the client only ever sends which option
  // index it picked per question, never a score or pass/fail it computed itself, so there's no
  // client-trusted value anywhere in this path (the same principle this app already applies to
  // real payment verification elsewhere).
  let correctCount = 0;
  const results = questions.map((q, i) => {
    const correct = answers[i] === q.correct_index;
    if (correct) correctCount++;
    return { questionId: q.id, correct, correctIndex: q.correct_index, explanation: q.explanation };
  });
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= 70;

  await query(
    "INSERT INTO quiz_attempts (user_id, chapter_id, score, passed) VALUES ($1, $2, $3, $4)",
    [req.user.sub, chapterId, score, passed]
  );

  res.json({ score, passed, results });
});

// A visitor's own attempt history for one chapter -- used to show "you already passed this" or a
// past score without making them retake it, but never anyone else's attempts.
router.get("/chapters/:chapterId/quiz/my-attempts", requireAuth, async (req, res) => {
  const result = await query(
    "SELECT score, passed, created_at FROM quiz_attempts WHERE user_id = $1 AND chapter_id = $2 ORDER BY created_at DESC",
    [req.user.sub, req.params.chapterId]
  );
  res.json({ attempts: result.rows.map((r) => ({ score: r.score, passed: r.passed, createdAt: r.created_at })) });
});

// --- Admin question management ---

function publicQuestionForAdmin(row) {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    number: row.number,
    question: row.question,
    options: row.options,
    correctIndex: row.correct_index,
    explanation: row.explanation,
  };
}

function validateQuestionInput(body, { partial } = {}) {
  const { question, options, correctIndex, explanation, number } = body || {};
  if (!partial || question !== undefined) {
    if (!question || typeof question !== "string" || !question.trim() || question.length > 500) return "A valid question is required.";
  }
  if (!partial || options !== undefined) {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6 || options.some((o) => typeof o !== "string" || !o.trim())) {
      return "options must be an array of 2 to 6 non-empty strings.";
    }
  }
  if (!partial || correctIndex !== undefined) {
    const opts = options !== undefined ? options : (partial ? undefined : []);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || (opts && correctIndex >= opts.length)) {
      return "correctIndex must be a valid index into options.";
    }
  }
  if (!partial || explanation !== undefined) {
    if (!explanation || typeof explanation !== "string" || !explanation.trim() || explanation.length > 800) return "A valid explanation is required.";
  }
  if (number !== undefined) {
    if (!Number.isInteger(number) || number < 1) return "Number must be a whole number, at least 1.";
  }
  return null;
}

// Admin view of a chapter's questions -- unlike the public /quiz route, this includes the
// correct answer and explanation, since only Content-permitted staff can reach it at all.
router.get("/admin/chapters/:chapterId/quiz-questions", requireAuth, requirePermission("Content"), async (req, res) => {
  const result = await query("SELECT * FROM quiz_questions WHERE chapter_id = $1 ORDER BY number ASC", [req.params.chapterId]);
  res.json({ questions: result.rows.map(publicQuestionForAdmin) });
});

router.post("/chapters/:chapterId/quiz-questions", requireAuth, requirePermission("Content"), async (req, res) => {
  const { chapterId } = req.params;
  const validationError = validateQuestionInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const chapter = await query("SELECT id FROM chapters WHERE id = $1", [chapterId]);
  if (!chapter.rows[0]) return res.status(404).json({ error: "Chapter not found." });

  const { question, options, correctIndex, explanation, number } = req.body;
  let questionNumber = number;
  if (questionNumber === undefined) {
    const maxResult = await query("SELECT COALESCE(MAX(number), 0) AS max FROM quiz_questions WHERE chapter_id = $1", [chapterId]);
    questionNumber = maxResult.rows[0].max + 1;
  }

  const id = `${chapterId}-q${questionNumber}`;
  const existing = await query("SELECT id FROM quiz_questions WHERE id = $1", [id]);
  if (existing.rows[0]) return res.status(409).json({ error: `Question ${questionNumber} already exists for this chapter.` });

  const result = await query(
    "INSERT INTO quiz_questions (id, chapter_id, number, question, options, correct_index, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    [id, chapterId, questionNumber, question.trim(), options.map((o) => o.trim()), correctIndex, explanation.trim()]
  );
  res.status(201).json({ question: publicQuestionForAdmin(result.rows[0]) });
});

router.patch("/quiz-questions/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const { id } = req.params;
  const validationError = validateQuestionInput(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = await query("SELECT * FROM quiz_questions WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Question not found." });

  const current = existing.rows[0];
  const { question, options, correctIndex, explanation, number } = req.body;
  const nextOptions = options !== undefined ? options.map((o) => o.trim()) : current.options;
  const nextCorrectIndex = correctIndex !== undefined ? correctIndex : current.correct_index;
  if (nextCorrectIndex >= nextOptions.length) {
    return res.status(400).json({ error: "correctIndex must be a valid index into options." });
  }

  const result = await query(
    `UPDATE quiz_questions SET question = $1, options = $2, correct_index = $3, explanation = $4, number = $5, updated_at = now() WHERE id = $6 RETURNING *`,
    [
      question !== undefined ? question.trim() : current.question,
      nextOptions,
      nextCorrectIndex,
      explanation !== undefined ? explanation.trim() : current.explanation,
      number !== undefined ? number : current.number,
      id,
    ]
  );
  res.json({ question: publicQuestionForAdmin(result.rows[0]) });
});

router.delete("/quiz-questions/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const result = await query("DELETE FROM quiz_questions WHERE id = $1 RETURNING *", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Question not found." });
  res.json({ ok: true });
});

module.exports = router;
module.exports.hasCourseAccessForChapter = hasCourseAccessForChapter;
