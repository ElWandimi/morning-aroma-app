-- Morning Aroma backend — real business settings, replacing what was until now purely client-side
-- React state (useState in AdminDataProvider). Found via a real user report: an admin editing
-- Settings (e.g. the announcement banner) would see the change take effect immediately, then
-- silently revert on the next hard refresh -- the exact same class of bug already fixed for
-- products and green_beans, just not yet reported for this area.
-- Run this against the same Postgres database as the earlier migrations, after them.

-- A genuine single-row table, enforced by the CHECK constraint below rather than by convention
-- alone -- there is exactly one business, so there should only ever be exactly one settings row.
-- A JSONB blob for the actual settings themselves (not individual columns) since these ~13 fields
-- are simple, stable, and never queried or filtered at the SQL level -- a new setting can be added
-- later without a schema migration, the same tradeoff already made for products.tags/profile.
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data below is generated programmatically from src/data/index.js's DEFAULT_SETTINGS
-- constant (see server/scripts/generate-settings-seed.mjs), not hand-transcribed -- the same
-- discipline already applied to the products and green_beans migrations. ON CONFLICT DO NOTHING
-- makes this migration safe to re-run without overwriting real settings an admin has since edited.

INSERT INTO settings (id, data)
VALUES (1, '{"tagline":"Where quality meets its scent.","announcementEnabled":true,"announcementText":"Free shipping on orders over $60 — this week only.","contactEmail":"hello@morningaroma.com","whatsappNumber":"+254712345678","phoneNumber":"+254 712 345 678","businessName":"Morning Aroma Coffee Roasters Ltd.","businessAddress":"Nairobi, Kenya","taxId":"","taxRatePercent":0,"invoiceNotes":"Payment due within 14 days of invoice date. Thank you for your business.","instagramHandle":"","facebookUrl":"","notificationTypes":["Orders","Quotations","Service Inquiries","Green Orders","Feedback","Live Chat"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
