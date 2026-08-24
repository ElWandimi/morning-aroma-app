-- Morning Aroma backend — green coffee (wholesale) schema, the same real-catalog migration
-- retail products got, applied to the parallel wholesale system that was deliberately left
-- untouched in that earlier round. Same underlying problem: admin edits here still only ever
-- lived in client-side React memory (customGreenBeans, greenPriceOverrides, greenStockOverrides,
-- removedGreenBeanIds), silently reverting on refresh, just not yet reported the way the retail
-- version was.
-- Run this against the same Postgres database as the earlier migrations, after them.

CREATE TABLE IF NOT EXISTS green_beans (
  id                  TEXT PRIMARY KEY, -- kept as the existing "green-<slug>" format, not a new
                                         -- UUID, for the same reason products.id was kept as-is:
                                         -- real green orders (green_orders, still a separate,
                                         -- not-yet-migrated system) already reference this id
  name                TEXT NOT NULL,
  country             TEXT NOT NULL,
  roasted_id          TEXT REFERENCES products (id), -- the corresponding retail roast, if any --
                                                       -- nullable, since an admin-added green lot
                                                       -- has no retail counterpart by default
  price_per_kg_cents  INTEGER NOT NULL,
  stock_kg            INTEGER NOT NULL DEFAULT 0,
  min_order_kg        INTEGER NOT NULL DEFAULT 1,
  cupping_score       INTEGER,
  moisture            TEXT,
  grade               TEXT,
  process             TEXT,
  notes               TEXT,
  removed             BOOLEAN NOT NULL DEFAULT false, -- soft-delete, same reasoning as products.removed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_green_beans_removed ON green_beans (removed);

-- Seed data below is generated programmatically from src/data/index.js's GREEN_BEANS array (see
-- server/scripts/generate-green-bean-seed.mjs), not hand-transcribed -- same reasoning as the
-- retail products migration: avoids a transcription error silently shipping wrong prices for
-- several complex records. ON CONFLICT DO NOTHING makes this migration safe to re-run.

-- Generated programmatically from src/data/index.js's GREEN_BEANS array -- do not
-- hand-edit the values below; regenerate this file if the source data changes before
-- this migration has been run anywhere.

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-panama', 'Green Panama — Boquete', 'Panama', 'geisha-panama', 1400, 180, 5, 89, '10.8%', '17/18', 'Washed', 'The same Geisha lot selection we roast ourselves, sold green for roasters who want to develop their own profile.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-brazil', 'Green Brazil — Minas Gerais', 'Brazil', 'laurina-brazil', 550, 620, 10, 83, '11.2%', '17/18', 'Natural', 'Naturally low-caffeine Laurina, sun-dried on raised beds. High-volume lot, competitively priced.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-kenya', 'Green Kenya — Nyeri', 'Kenya', 'sl28-kenya', 950, 240, 5, 87, '10.5%', 'AA', 'Washed (double-fermented)', 'Same SL28 lot as our retail roast. Graded AA per Kenya''s own convention, not screen size.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-elsalvador', 'Green El Salvador — Ahuachapán', 'El Salvador', 'pacamara-elsalvador', 750, 90, 5, 85, '11.0%', '18', 'Honey', 'Large-bean Pacamara hybrid, honey processed. Limited lot — same scarcity as the roasted version.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-rwanda', 'Green Rwanda — Lake Kivu', 'Rwanda', 'bourbon-rwanda', 680, 410, 10, 84, '10.9%', '17', 'Washed', 'Fully washed Bourbon, sun-dried on raised beds near Lake Kivu.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-guatemala', 'Green Guatemala — Antigua', 'Guatemala', 'typica-guatemala', 640, 350, 10, 84, '11.1%', '17/18', 'Washed', 'Classic Antigua Typica, volcanic soil. A dependable, well-balanced roasting base.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-colombia', 'Green Colombia — Huila', 'Colombia', 'caturra-colombia', 620, 480, 10, 83, '11.0%', '17', 'Washed', 'Patio-dried Caturra from Huila. Our highest-volume green offering.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-honduras', 'Green Honduras — Copán', 'Honduras', 'catuai-honduras', 480, 300, 10, 81, '11.3%', '16/17', 'Washed', 'Shade-grown Catuai from Copán. Our most affordable green offering, still fully traceable.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO green_beans (id, name, country, roasted_id, price_per_kg_cents, stock_kg, min_order_kg, cupping_score, moisture, grade, process, notes)
VALUES ('green-ethiopia', 'Green Ethiopia — Yirgacheffe', 'Ethiopia', 'yirgacheffe-ethiopia', 850, 160, 5, 88, '10.6%', '16', 'Washed', 'Same forest-shaded Gedeo Zone lot as our Yirgacheffe roast. A favorite among light-roast specialists.')
ON CONFLICT (id) DO NOTHING;

-- Total green beans seeded: 9
