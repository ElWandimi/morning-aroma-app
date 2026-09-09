const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// XP thresholds sized to what's actually achievable today (3 courses with real quizzes, 21
// questions, so a max of ~525 XP from lessons + 300 from certificates = 825) -- not the
// hundreds-of-XP-per-action scheme a much larger content library might warrant. Revisit these
// numbers as more courses get real quizzes; they're deliberately not meant to be permanent.
const LEVELS = [
  { name: "Coffee Novice", min: 0 },
  { name: "Bean Explorer", min: 25 },
  { name: "Brew Apprentice", min: 75 },
  { name: "Certified Taster", min: 150 },
  { name: "Barista in Training", min: 250 },
  { name: "Coffee Professional", min: 400 },
];

function levelForXp(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.min) current = level;
  }
  return current.name;
}

// Longest run of consecutive days (ending today or yesterday -- a streak "counts" through today
// even before you've done anything today, the same way most streak features work) with at least
// one real quiz attempt. Computed directly from quiz_attempts.created_at, not a separately
// tracked/mutable counter, so it can never drift out of sync with what actually happened.
function computeStreak(attemptDates) {
  if (attemptDates.length === 0) return 0;
  const days = new Set(attemptDates.map((d) => new Date(d).toISOString().slice(0, 10)));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let cursor = new Date(today);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1); // streak can still be "alive" if yesterday counts
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

router.get("/users/me/academy-stats", requireAuth, async (req, res) => {
  const userId = req.user.sub;

  const passedResult = await query(
    "SELECT DISTINCT chapter_id FROM quiz_attempts WHERE user_id = $1 AND passed = true",
    [userId]
  );
  const passedChapterCount = passedResult.rows.length;

  const certResult = await query("SELECT COUNT(*) AS count FROM certificates WHERE user_id = $1", [userId]);
  const certificateCount = Number(certResult.rows[0].count);

  const perfectResult = await query(
    "SELECT 1 FROM quiz_attempts WHERE user_id = $1 AND score = 100 LIMIT 1",
    [userId]
  );
  const hasPerfectScore = !!perfectResult.rows[0];

  const attemptDatesResult = await query("SELECT created_at FROM quiz_attempts WHERE user_id = $1", [userId]);
  const streak = computeStreak(attemptDatesResult.rows.map((r) => r.created_at));

  const xp = passedChapterCount * 25 + certificateCount * 100;
  const level = levelForXp(xp);

  const badges = [];
  if (passedChapterCount >= 1) badges.push({ id: "first-quiz", name: "First Quiz Passed", description: "Passed your first lesson quiz." });
  if (passedChapterCount >= 10) badges.push({ id: "quiz-enthusiast", name: "Quiz Enthusiast", description: "Passed 10 lesson quizzes." });
  if (hasPerfectScore) badges.push({ id: "perfectionist", name: "Perfectionist", description: "Scored 100% on a quiz." });
  if (certificateCount >= 1) badges.push({ id: "certified", name: "Certified", description: "Earned your first certificate." });
  if (certificateCount >= 3) badges.push({ id: "multi-certified", name: "Multi-Certified", description: "Earned 3 certificates." });
  if (streak >= 3) badges.push({ id: "on-a-roll", name: "On a Roll", description: "A 3-day quiz streak." });
  if (streak >= 7) badges.push({ id: "dedicated", name: "Dedicated", description: "A 7-day quiz streak." });

  res.json({ xp, level, passedChapterCount, certificateCount, streak, badges });
});

module.exports = router;
