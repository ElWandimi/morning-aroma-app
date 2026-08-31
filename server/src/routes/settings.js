const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// A hard cap on which keys can ever be written -- an admin submitting an unexpected key (or a
// bug submitting one) can't silently grow this object with junk that was never a real setting.
// Kept in sync with DEFAULT_SETTINGS in src/data/index.js by convention; both need updating
// together if a new setting is ever added.
const VALID_KEYS = new Set([
  "tagline", "announcementEnabled", "announcementText", "contactEmail", "whatsappNumber",
  "phoneNumber", "businessName", "businessAddress", "taxId", "taxRatePercent", "invoiceNotes",
  "instagramHandle", "facebookUrl", "notificationTypes", "academyLifetimePriceCents",
]);

// Mirrors DEFAULT_SETTINGS in src/data/index.js -- duplicated here (the backend can't import
// straight from a frontend source file) specifically as a real safety net, not just a test
// convenience: if this migration hasn't been run yet on a given deployment (a real, plausible
// mistake -- there are several migrations to run in order by this point in the project), GET
// /settings falls back to these sensible defaults instead of an empty object that would leave
// the announcement banner, contact info, and structured data all blank on a live site.
const FALLBACK_SETTINGS = {
  tagline: "Where quality meets its scent.",
  announcementEnabled: true,
  announcementText: "Free shipping on orders over $60 — this week only.",
  contactEmail: "hello@morningaroma.com",
  whatsappNumber: "+254712345678",
  phoneNumber: "+254 712 345 678",
  businessName: "Morning Aroma Coffee Roasters Ltd.",
  businessAddress: "Nairobi, Kenya",
  taxId: "",
  taxRatePercent: 0,
  invoiceNotes: "Payment due within 14 days of invoice date. Thank you for your business.",
  instagramHandle: "",
  facebookUrl: "",
  notificationTypes: ["Orders", "Quotations", "Service Inquiries", "Green Orders", "Feedback", "Live Chat"],
  // A real, reasonable starting value -- roughly what a year of two or three individual courses
  // would cost combined, making lifetime access a genuine value proposition rather than an
  // arbitrary placeholder. Admin-editable from here on, same as every other setting.
  academyLifetimePriceCents: 24900,
};

// Public -- the announcement banner and structured data (business name, contact info) are shown
// to every visitor, not just admin, same reasoning already applied to GET /products.
router.get("/", async (req, res) => {
  const result = await query("SELECT data FROM settings WHERE id = 1", []);
  res.json({ settings: result.rows[0] ? result.rows[0].data : FALLBACK_SETTINGS });
});

// Partial update, merging into the existing settings rather than replacing them wholesale --
// matches the existing frontend contract (setSettings(patch) in AdminDataProvider), where saving
// the Settings form has always meant "apply these changes," not "this is now the complete set of
// every setting that exists." Merged at the application level (fetch, merge in JS, write back)
// rather than Postgres's jsonb `||` concatenation operator -- keeps this portable to the SQLite
// test harness, where `||` means string concatenation, not JSONB merge, and would silently do the
// wrong thing rather than error.
router.patch("/", requireAuth, requirePermission("Settings"), async (req, res) => {
  const patch = req.body || {};
  const unknownKeys = Object.keys(patch).filter((k) => !VALID_KEYS.has(k));
  if (unknownKeys.length > 0) {
    return res.status(400).json({ error: `Unknown setting(s): ${unknownKeys.join(", ")}` });
  }

  const existing = await query("SELECT data FROM settings WHERE id = 1", []);
  const current = existing.rows[0] ? existing.rows[0].data : FALLBACK_SETTINGS;
  const merged = { ...current, ...patch };

  const result = await query(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()
     RETURNING data`,
    [JSON.stringify(merged)]
  );
  res.json({ settings: result.rows[0].data });
});

module.exports = router;
