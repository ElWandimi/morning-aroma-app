const express = require("express");
const crypto = require("crypto");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { sendCourseCompletionEmail } = require("../utils/email");

const router = express.Router();

// Same real access check as quizzes.js's hasCourseAccessForChapter, but starting from a courseId
// directly rather than a chapterId -- certificates are issued per course, not per chapter.
async function hasCourseAccess(userId, courseId) {
  const lifetime = await query("SELECT 1 FROM academy_lifetime_access WHERE user_id = $1", [userId]);
  if (lifetime.rows[0]) return true;
  const sub = await query(
    "SELECT 1 FROM subscriptions WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'paused')",
    [userId, courseId]
  );
  return !!sub.rows[0];
}

// A course is "completed" when every one of its chapters that actually has a quiz has been
// passed by this user at least once -- a course with zero quizzed chapters is never eligible
// (nothing to have completed), rather than trivially "complete" by having nothing to fail.
async function courseCompletionStatus(userId, courseId) {
  const assessedResult = await query(
    `SELECT c.id FROM chapters c
     WHERE c.course_id = $1 AND EXISTS (SELECT 1 FROM quiz_questions q WHERE q.chapter_id = c.id)`,
    [courseId]
  );
  const assessedChapterIds = assessedResult.rows.map((r) => r.id);
  if (assessedChapterIds.length === 0) {
    return { eligible: false, assessedChapterCount: 0, passedChapterCount: 0 };
  }

  const passedResult = await query(
    `SELECT DISTINCT chapter_id FROM quiz_attempts
     WHERE user_id = $1 AND passed = true AND chapter_id = ANY($2::text[])`,
    [userId, assessedChapterIds]
  );
  const passedChapterCount = passedResult.rows.length;
  return {
    eligible: passedChapterCount === assessedChapterIds.length,
    assessedChapterCount: assessedChapterIds.length,
    passedChapterCount,
  };
}

function generateVerificationCode() {
  // 8 uppercase alphanumeric characters -- short enough to type from a printed certificate,
  // long enough (36^8, well over 2 trillion combinations) that a collision is never realistically
  // hit in practice; the DB's own UNIQUE constraint plus the retry loop below is the real
  // guarantee, this is just what keeps that retry loop from ever actually needing to fire.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I -- easy to misread when printed
  let code = "MA-";
  for (let i = 0; i < 8; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

function publicCertificate(row, courseName, studentName) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName,
    studentName,
    verificationCode: row.verification_code,
    issuedAt: row.issued_at,
  };
}

router.get("/courses/:courseId/certificate-eligibility", requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const allowed = await hasCourseAccess(req.user.sub, courseId);
  if (!allowed) return res.json({ eligible: false, assessedChapterCount: 0, passedChapterCount: 0, reason: "no_access" });
  const status = await courseCompletionStatus(req.user.sub, courseId);
  res.json(status);
});

router.post("/courses/:courseId/certificate", requireAuth, async (req, res) => {
  const { courseId } = req.params;

  const course = await query("SELECT * FROM courses WHERE id = $1", [courseId]);
  if (!course.rows[0]) return res.status(404).json({ error: "Course not found." });

  const allowed = await hasCourseAccess(req.user.sub, courseId);
  if (!allowed) return res.status(403).json({ error: "You need an active subscription or lifetime access to this course." });

  // Re-checked here, server-side, on every request -- never trusts that the frontend only shows
  // this button when eligible. A request from someone who hasn't actually passed every quizzed
  // chapter is rejected regardless of what the client believes its own state to be.
  const status = await courseCompletionStatus(req.user.sub, courseId);
  if (!status.eligible) {
    return res.status(403).json({ error: "You haven't completed every quiz in this course yet.", ...status });
  }

  const user = await query("SELECT name, email FROM users WHERE id = $1", [req.user.sub]);

  const existing = await query("SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2", [req.user.sub, courseId]);
  if (existing.rows[0]) {
    return res.json({ certificate: publicCertificate(existing.rows[0], course.rows[0].name, user.rows[0].name) });
  }

  // Retries on the rare chance of a code collision -- the DB's UNIQUE constraint is the real
  // guarantee; this just means a collision produces a fresh code instead of an error.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = generateVerificationCode();
      const inserted = await query(
        "INSERT INTO certificates (user_id, course_id, verification_code) VALUES ($1, $2, $3) RETURNING *",
        [req.user.sub, courseId, code]
      );
      const certificate = publicCertificate(inserted.rows[0], course.rows[0].name, user.rows[0].name);

      // Real "what to take next" -- same category, a different course, whichever real course in
      // it was created first (ORDER BY created_at rather than something arbitrary like name).
      // Genuinely absent, not a placeholder, when nothing else exists in the category yet.
      const nextCourseResult = await query(
        "SELECT id, name FROM courses WHERE category = $1 AND id != $2 AND removed = false ORDER BY created_at ASC LIMIT 1",
        [course.rows[0].category, courseId]
      );
      const nextCourse = nextCourseResult.rows[0] || null;

      sendCourseCompletionEmail(user.rows[0], course.rows[0], certificate, nextCourse)
        .catch((err) => console.error("Failed to send course completion email:", err));

      return res.status(201).json({ certificate });
    } catch (e) {
      if (e.code !== "23505" || attempt === 4) throw e; // 23505 = unique_violation
    }
  }
});

router.get("/users/me/certificates", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT cert.*, co.name AS course_name, u.name AS student_name
     FROM certificates cert
     JOIN courses co ON co.id = cert.course_id
     JOIN users u ON u.id = cert.user_id
     WHERE cert.user_id = $1 ORDER BY cert.issued_at DESC`,
    [req.user.sub]
  );
  res.json({ certificates: result.rows.map((r) => publicCertificate(r, r.course_name, r.student_name)) });
});

// Public, deliberately -- this is the whole point of a verification code: anyone holding one
// (printed on the certificate itself) can confirm it's real, without needing an account.
router.get("/certificates/verify/:code", async (req, res) => {
  const result = await query(
    `SELECT cert.*, co.name AS course_name, u.name AS student_name
     FROM certificates cert
     JOIN courses co ON co.id = cert.course_id
     JOIN users u ON u.id = cert.user_id
     WHERE cert.verification_code = $1`,
    [req.params.code]
  );
  if (!result.rows[0]) return res.json({ valid: false });
  const row = result.rows[0];
  res.json({ valid: true, courseName: row.course_name, studentName: row.student_name, issuedAt: row.issued_at });
});

module.exports = router;
