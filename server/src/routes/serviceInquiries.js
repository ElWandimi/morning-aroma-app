const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

// Kept in sync with the <select id="svc-interest"> options in src/pages/Services.jsx -- expanded
// from the original 2 services to the real, full consulting lineup (grading, roast profiles,
// cupping, equipment, menu development, packaging, barista training, and sourcing), each of which
// is now also its own entry in the SERVICES data array those options describe on the page itself.
const VALID_INTERESTS = [
  "Remote Consulting",
  "Kenyan Auction Representation",
  "Coffee Grading & Quality Analysis",
  "Roast Profile Development",
  "Sensory Evaluation & Cupping Sessions",
  "Equipment Consulting",
  "Café Menu & Brew Method Development",
  "Packaging & Shelf-Life Consultation",
  "Barista & Staff Training",
  "Business & Sourcing Consultation",
  "Not sure yet",
];

function publicInquiry(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    interest: row.interest,
    message: row.message,
    status: row.status,
    agreedFeeCents: row.agreed_fee_cents,
    date: createdAtIso.slice(0, 10),
    createdAt: createdAtIso,
  };
}

router.post("/", inquiryLimiter, async (req, res) => {
  const { name, email, company, interest, message } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name is required (max 120 characters)." });
  if (typeof email !== "string" || !email.trim() || email.length > 254) return res.status(400).json({ error: "email is required (max 254 characters)." });
  if (!VALID_INTERESTS.includes(interest)) return res.status(400).json({ error: `interest must be one of: ${VALID_INTERESTS.join(", ")}` });
  if (typeof message !== "string" || !message.trim() || message.length > 1000) return res.status(400).json({ error: "message is required (max 1000 characters)." });
  if (company !== undefined && company !== null && (typeof company !== "string" || company.length > 120)) return res.status(400).json({ error: "company must be 120 characters or fewer." });

  const inserted = await query(
    "INSERT INTO service_inquiries (name, email, company, interest, message) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [name.trim(), email.trim(), company?.trim() || null, interest, message.trim()]
  );
  res.status(201).json({ inquiry: publicInquiry(inserted.rows[0]) });
});

router.get("/", requireAuth, requirePermission("Service Inquiries"), async (req, res) => {
  const result = await query("SELECT * FROM service_inquiries ORDER BY created_at DESC", []);
  res.json({ inquiries: result.rows.map(publicInquiry) });
});

router.patch("/:id/status", requireAuth, requirePermission("Service Inquiries"), async (req, res) => {
  const { status } = req.body || {};
  if (!["New", "Discovery Call Booked", "In Progress", "Closed"].includes(status)) return res.status(400).json({ error: "status must be a real, valid stage." });
  const result = await query("UPDATE service_inquiries SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Inquiry not found." });
  res.json({ inquiry: publicInquiry(result.rows[0]) });
});

// A real, admin-entered consulting fee -- separate from status, since a fee can genuinely be
// agreed (or revised) without the inquiry's own stage changing at that exact moment.
router.patch("/:id/fee", requireAuth, requirePermission("Service Inquiries"), async (req, res) => {
  const { agreedFeeCents } = req.body || {};
  if (typeof agreedFeeCents !== "number" || !Number.isInteger(agreedFeeCents) || agreedFeeCents < 0) {
    return res.status(400).json({ error: "agreedFeeCents must be a non-negative whole number of cents." });
  }
  const result = await query("UPDATE service_inquiries SET agreed_fee_cents = $1 WHERE id = $2 RETURNING *", [agreedFeeCents, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Inquiry not found." });
  res.json({ inquiry: publicInquiry(result.rows[0]) });
});

module.exports = router;
