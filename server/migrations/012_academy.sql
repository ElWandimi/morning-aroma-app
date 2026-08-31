-- Real Academy courses, moved out of static frontend data (src/data/index.js) into the database
-- -- the same migration this project already did for products, and for the same reason: an
-- admin-editable price requires real, persistent, backend-managed data, not a value baked into
-- the frontend bundle.

CREATE TABLE IF NOT EXISTS courses (
  id                    TEXT PRIMARY KEY, -- kept as the existing slug format (e.g. "espresso"),
                                           -- matching how products.id works, so existing
                                           -- frontend routes/URLs referencing a course by its
                                           -- slugified name keep working unchanged
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  blurb                 TEXT NOT NULL,
  instructor            TEXT NOT NULL,
  lessons               INTEGER NOT NULL,
  monthly_price_cents   INTEGER NOT NULL, -- USD cents, admin-editable; the real annual price is
                                           -- always derived from this at 20% off (12 x 0.8), not
                                           -- stored separately, so the two can never drift apart
  removed               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_removed ON courses (removed);

-- A course subscription has no shipping at all, unlike a product one -- these three columns were
-- originally NOT NULL (011_subscriptions.sql), which only made sense back when every subscription
-- was necessarily a product.
ALTER TABLE subscriptions ALTER COLUMN shipping_name DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN shipping_address DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN shipping_city DROP NOT NULL;

-- Generalizing the existing subscriptions tables (011_subscriptions.sql) to support course
-- access, not just product shipments -- product_id becomes nullable, a new course_id is added
-- (also nullable), and exactly one of the two must be set on any given row, since a subscription
-- is always one kind or the other, never both and never neither.
ALTER TABLE subscriptions ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_exactly_one_target
  CHECK ((product_id IS NOT NULL AND course_id IS NULL) OR (product_id IS NULL AND course_id IS NOT NULL));

ALTER TABLE subscription_plans ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id);
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_exactly_one_target
  CHECK ((product_id IS NOT NULL AND course_id IS NULL) OR (product_id IS NULL AND course_id IS NOT NULL));
-- The original unique constraint assumed product_id was always present; replaced with two partial
-- unique indexes so a product+interval+price combination and a course+interval+price combination
-- are each still guaranteed at most one cached Plan.
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_product_id_interval_amount_kes_cents_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_product_target ON subscription_plans (product_id, interval, amount_kes_cents) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_course_target ON subscription_plans (course_id, interval, amount_kes_cents) WHERE course_id IS NOT NULL;

-- A one-time lifetime purchase granting permanent access to every course, including ones added
-- later -- fundamentally not a subscription (no recurring charge, no Paystack Subscription object
-- involved at all), so it gets its own table rather than being shoehorned into the subscriptions
-- table above. The real, admin-editable price itself lives in the existing settings table's JSON
-- blob (see server/src/routes/settings.js), matching how every other site-wide, non-per-item
-- price already works in this app.
CREATE TABLE IF NOT EXISTS academy_lifetime_access (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) UNIQUE,
  paystack_reference  TEXT NOT NULL UNIQUE,
  amount_usd_cents    INTEGER NOT NULL,
  amount_kes_cents    INTEGER NOT NULL,
  purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data matches src/data/index.js's existing static COURSES array exactly (name, category,
-- blurb, instructor, lessons) -- monthly_price_cents is new (courses never had a real price at
-- all before this feature), a genuine starting point scaled roughly by lesson count/depth, not
-- arbitrary placeholders -- and is admin-editable afterward, which is the whole point of this
-- migration existing.
INSERT INTO courses (id, name, category, blurb, instructor, lessons, monthly_price_cents) VALUES
('espresso', 'Espresso', 'Barista Skills', 'Dial in grind, dose, and shot time to pull a balanced espresso every time.', 'Amara Wanjiru', 6, 999),
('cappuccino', 'Cappuccino', 'Barista Skills', 'Steam milk to a glossy microfoam and layer it into a classic 1:1:1 cappuccino.', 'Amara Wanjiru', 5, 899),
('latte', 'Latte', 'Barista Skills', 'Stretch milk longer and practice your first heart, rosetta, and tulip pours.', 'Amara Wanjiru', 5, 899),
('flat-white', 'Flat White', 'Barista Skills', 'A tighter milk texture and higher ratio — the espresso-forward middle ground.', 'Dinesh Rao', 4, 799),
('mocha', 'Mocha', 'Barista Skills', 'Balance chocolate, espresso, and steamed milk without losing the coffee.', 'Dinesh Rao', 4, 799),
('americano', 'Americano', 'Barista Skills', 'Understand how water ratio and pour order change body and crema.', 'Dinesh Rao', 3, 699),
('cold-brew', 'Cold Brew', 'Barista Skills', 'Steep ratios, filtration, and how to build a cold brew concentrate menu.', 'Amara Wanjiru', 4, 799),
('turkish', 'Turkish', 'Barista Skills', 'Fine-grind, unfiltered brewing in a cezve, with the traditional foam cap.', 'Leyla Demir', 4, 799),
('vietnamese', 'Vietnamese', 'Barista Skills', 'Slow-drip phin filters over condensed milk, hot or over ice.', 'Mai Tran', 3, 699),
('moka-pot', 'Moka Pot', 'Barista Skills', 'Get consistent stovetop extraction without the bitter, burnt-out cup.', 'Dinesh Rao', 3, 699),
('affogato', 'Affogato', 'Barista Skills', 'One shot, one scoop — timing and glassware for the simplest dessert drink.', 'Amara Wanjiru', 2, 599),
('home-brewing', 'Home Brewing', 'Home Brewing', 'Pour-over, French press, and Aeropress fundamentals for your own kitchen.', 'Kofi Mensah', 7, 1099),
('sensory-cupping', 'Sensory & Cupping', 'Sensory', 'Train your palate to name acidity, body, and aftertaste like a professional cupper.', 'Elena Rossi', 6, 1299),
('roasting-fundamentals', 'Roasting Fundamentals', 'Professional', 'First crack, development time, and how roast curves shape flavor.', 'Kofi Mensah', 8, 1799),
('cafe-management', 'Cafe Management', 'Professional', 'Costing, staffing, and menu design for running a specialty coffee bar.', 'Elena Rossi', 9, 1999)
ON CONFLICT (id) DO NOTHING;

-- Total courses seeded: 15
