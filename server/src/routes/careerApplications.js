const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Same real reasoning as feedback.js's own limiter -- a genuinely public, anonymous,
// unauthenticated endpoint, still worth real spam protection. A real applicant has no reason to
// submit more than a couple times in 15 minutes.
const careerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again in a few minutes." },
});

function publicApplication(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    location: row.location,
    roleInterest: row.role_interest,
    message: row.message,
    resumeUrl: row.resume_url,
    status: row.status,
    createdAt: createdAtIso,
  };
}

// Anonymous, no account required -- matches this app's own established pattern for every other
// genuinely public submission (feedback, live chat, the wholesale/service contact forms).
router.post("/", careerLimiter, async (req, res) => {
  const { name, email, location, roleInterest, message, resumeUrl } = req.body || {};

  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name is required (max 120 characters)." });
  if (typeof email !== "string" || !email.trim() || email.length > 254) return res.status(400).json({ error: "email is required (max 254 characters)." });
  if (typeof message !== "string" || !message.trim() || message.length > 4000) return res.status(400).json({ error: "message is required (max 4000 characters)." });
  if (location !== undefined && location !== null && (typeof location !== "string" || location.length > 200)) return res.status(400).json({ error: "location must be 200 characters or fewer." });
  if (roleInterest !== undefined && roleInterest !== null && (typeof roleInterest !== "string" || roleInterest.length > 200)) return res.status(400).json({ error: "roleInterest must be 200 characters or fewer." });
  // resumeUrl is a real, applicant-provided link (their own LinkedIn, a hosted resume, a
  // portfolio) -- this app has no file-upload infrastructure for this specifically, so a URL is
  // the honest, real option here, not a fake "upload" that goes nowhere. A basic http(s) check,
  // not a full, strict URL validator -- genuinely just catching an obviously wrong value (a bare
  // word, say) rather than being pedantic about a field the applicant is trusted to get right.
  if (resumeUrl !== undefined && resumeUrl !== null && resumeUrl !== "") {
    if (typeof resumeUrl !== "string" || resumeUrl.length > 500 || !/^https?:\/\//i.test(resumeUrl)) {
      return res.status(400).json({ error: "resumeUrl must be a real http(s) link." });
    }
  }

  const inserted = await query(
    "INSERT INTO career_applications (name, email, location, role_interest, message, resume_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [name.trim(), email.trim(), location?.trim() || null, roleInterest?.trim() || null, message.trim(), resumeUrl?.trim() || null]
  );
  res.status(201).json({ application: publicApplication(inserted.rows[0]) });
});

// Admin-only -- this is a real, if simple, applicant inbox, not something a visitor can browse.
router.get("/", requireAuth, requirePermission("Career Applications"), async (req, res) => {
  const result = await query("SELECT * FROM career_applications ORDER BY created_at DESC", []);
  res.json({ applications: result.rows.map(publicApplication) });
});

router.patch("/:id/status", requireAuth, requirePermission("Career Applications"), async (req, res) => {
  const { status } = req.body || {};
  if (!["New", "Reviewed", "Archived"].includes(status)) return res.status(400).json({ error: 'status must be "New", "Reviewed", or "Archived".' });
  const result = await query("UPDATE career_applications SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Application not found." });
  res.json({ application: publicApplication(result.rows[0]) });
});

module.exports = router;
