-- Morning Aroma backend — products schema (real product catalog, replacing frontend static data
-- + client-side-only admin overrides that never persisted past a page refresh)
-- Run this against the same Postgres database as the earlier migrations, after them.

CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY, -- kept as the existing slug format (e.g. "geisha-panama"),
                                         -- not a new UUID -- this exact id is already referenced
                                         -- throughout real orders (items[].id), cart, and wishlist
  name                TEXT NOT NULL,
  country             TEXT NOT NULL,
  tier                TEXT NOT NULL,    -- "everyday" | "premium"
  price_cents         INTEGER NOT NULL,
  stock               INTEGER NOT NULL DEFAULT 0,
  note                TEXT,
  tags                JSONB NOT NULL DEFAULT '{}',  -- { aroma: [], body, acidity, roast, moment, brew: [] }
  profile             JSONB NOT NULL DEFAULT '{}',  -- { aroma, body, acidity, sweetness, finish } (1-10 scale)
  growing             TEXT,
  brew_guide          TEXT,
  moment_match        TEXT,
  course              TEXT,
  photo_url           TEXT,             -- admin-uploaded photo override; NULL falls back to the
                                         -- frontend's existing static /photos/products/<id>.png convention
  removed             BOOLEAN NOT NULL DEFAULT false, -- soft-delete, matching the existing
                                                        -- discontinued-item behavior already built
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_removed ON products (removed);

-- Seed data below is generated programmatically from src/data/index.js's PRODUCTS array (see
-- server/scripts/generate-product-seed.mjs), not hand-transcribed -- avoids the real risk of a
-- transcription error silently shipping wrong prices or missing products for 9 complex records.
-- ON CONFLICT DO NOTHING makes this migration safe to re-run without duplicating rows.

-- Generated programmatically from src/data/index.js's PRODUCTS array -- do not hand-edit
-- the values below; regenerate this file if the source data changes before this
-- migration has been run anywhere.

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('geisha-panama', 'Geisha', 'Panama', 'premium', 4200, 6, 'Jasmine, bergamot, a whisper of honey', '{"aroma":["floral","citrus"],"body":"light","acidity":"high","roast":"light","moment":"First Light","brew":["Pour-Over","Aeropress"]}'::jsonb, '{"aroma":9,"body":4,"acidity":8,"sweetness":6,"finish":7}'::jsonb, 'Grown at 1,650–1,900m on volcanic soil in Boquete. Shade-grown under native trees, hand-picked, washed process.', 'Pour-Over', 'First Light', 'Sensory & Cupping')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('laurina-brazil', 'Laurina', 'Brazil', 'premium', 2900, 34, 'Low caffeine, delicate citrus florals', '{"aroma":["floral","citrus"],"body":"light","acidity":"medium","roast":"light","moment":"The Reset","brew":["Pour-Over"]}'::jsonb, '{"aroma":7,"body":3,"acidity":5,"sweetness":6,"finish":5}'::jsonb, 'Grown at 1,100–1,300m in Minas Gerais. Naturally low in caffeine, sun-dried on raised beds.', 'Pour-Over', 'The Reset', 'Sensory & Cupping')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('sl28-kenya', 'SL28', 'Kenya', 'premium', 3400, 3, 'Blackcurrant, tomato acidity, syrupy body', '{"aroma":["fruity","winey"],"body":"full","acidity":"high","roast":"medium","moment":"The Hustle","brew":["French Press","Moka Pot"]}'::jsonb, '{"aroma":8,"body":8,"acidity":9,"sweetness":7,"finish":8}'::jsonb, 'Grown at 1,700–2,000m on red volcanic soil in Nyeri. Double-fermented washed process.', 'French Press', 'The Hustle', 'Espresso')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('pacamara-elsalvador', 'Pacamara', 'El Salvador', 'premium', 2700, 0, 'Chocolate, dried fig, round finish', '{"aroma":["chocolate","fruity"],"body":"full","acidity":"medium","roast":"medium","moment":"Comfort","brew":["French Press"]}'::jsonb, '{"aroma":7,"body":8,"acidity":5,"sweetness":8,"finish":7}'::jsonb, 'Grown at 1,300–1,500m in Ahuachapán. Large-bean hybrid, honey processed.', 'French Press', 'Comfort', 'Home Brewing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('bourbon-rwanda', 'Bourbon', 'Rwanda', 'everyday', 1800, 120, 'Caramel, red apple, gentle body', '{"aroma":["sweet","fruity"],"body":"medium","acidity":"medium","roast":"medium","moment":"First Light","brew":["Pour-Over","Drip"]}'::jsonb, '{"aroma":6,"body":5,"acidity":5,"sweetness":7,"finish":6}'::jsonb, 'Grown at 1,700m near Lake Kivu. Fully washed, sun-dried on raised beds.', 'Pour-Over', 'First Light', 'Home Brewing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('typica-guatemala', 'Typica', 'Guatemala', 'everyday', 1700, 85, 'Cocoa, walnut, clean finish', '{"aroma":["nutty","chocolate"],"body":"medium","acidity":"low","roast":"medium-dark","moment":"Comfort","brew":["Moka Pot","Drip"]}'::jsonb, '{"aroma":5,"body":6,"acidity":3,"sweetness":6,"finish":5}'::jsonb, 'Grown at 1,400–1,600m in Antigua. Volcanic soil, washed process.', 'Moka Pot', 'Comfort', 'Home Brewing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('caturra-colombia', 'Caturra', 'Colombia', 'everyday', 1900, 60, 'Brown sugar, orange, bright', '{"aroma":["fruity","sweet"],"body":"medium","acidity":"high","roast":"medium","moment":"The Hustle","brew":["Pour-Over","Aeropress"]}'::jsonb, '{"aroma":6,"body":5,"acidity":7,"sweetness":7,"finish":6}'::jsonb, 'Grown at 1,500–1,800m in Huila. Washed process, dried on patios.', 'Aeropress', 'The Hustle', 'Home Brewing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('catuai-honduras', 'Catuai', 'Honduras', 'everyday', 1600, 45, 'Milk chocolate, soft acidity', '{"aroma":["chocolate","sweet"],"body":"medium","acidity":"low","roast":"medium-dark","moment":"The Reset","brew":["French Press","Drip"]}'::jsonb, '{"aroma":5,"body":5,"acidity":3,"sweetness":6,"finish":5}'::jsonb, 'Grown at 1,200–1,500m in Copán. Washed process, shade-grown.', 'French Press', 'The Reset', 'Home Brewing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, country, tier, price_cents, stock, note, tags, profile, growing, brew_guide, moment_match, course)
VALUES ('yirgacheffe-ethiopia', 'Yirgacheffe', 'Ethiopia', 'premium', 3300, 22, 'Blueberry, jasmine, bergamot', '{"aroma":["floral","fruity"],"body":"light","acidity":"high","roast":"light","moment":"First Light","brew":["Pour-Over","Aeropress"]}'::jsonb, '{"aroma":9,"body":3,"acidity":8,"sweetness":7,"finish":7}'::jsonb, 'Grown at 1,700–2,200m in the Gedeo Zone near Yirgacheffe town. Many farms are shaded under native forest canopy, hand-picked, fully washed process.', 'Pour-Over', 'First Light', 'Sensory & Cupping')
ON CONFLICT (id) DO NOTHING;

-- Total products seeded: 9
