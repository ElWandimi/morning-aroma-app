-- Two real, one-time fixes for the live green_beans table.
--
-- 1) Cleanup: at some point, test/demo rows got created directly through the admin dashboard
--    (id prefix "green-e2e-lot-..." or similar, all with country = 'Panama', a generic
--    "A new green lot from Panama." note, and identical price/stock) rather than through this
--    repo's seed migration (006_green_beans.sql). Those aren't referenced by any real order --
--    a genuinely-ordered lot only ever comes from the real 9-lot catalog below -- so a hard
--    DELETE is safe here, unlike the soft-delete convention used for a lot that was real and is
--    now discontinued.
--
--    Run the SELECT first to see exactly what this will remove before running the DELETE.

-- Diagnostic: see what's actually live right now.
SELECT id, name, country, price_per_kg_cents, stock_kg, created_at
FROM green_beans
ORDER BY created_at DESC;

-- Cleanup: removes only rows that are NOT one of the real 9 seeded lot ids. Safe to re-run --
-- if the real 9 are already the only rows left, this deletes nothing.
DELETE FROM green_beans
WHERE id NOT IN (
  'green-panama', 'green-brazil', 'green-kenya', 'green-elsalvador', 'green-rwanda',
  'green-guatemala', 'green-colombia', 'green-honduras', 'green-ethiopia'
);

-- 2) A per-bean photo column, so a specific lot (right now just Kenya, which has a real
--    Morning Aroma product photo) can show its own bundled image instead of only ever falling
--    back to the shared, country-keyed stock photo. NULL for every other lot -- the frontend
--    already falls back to the country photo when this is unset, so no other UPDATE is needed.
ALTER TABLE green_beans ADD COLUMN IF NOT EXISTS photo_url TEXT;

UPDATE green_beans SET photo_url = '/photos/green-beans/kenya-bag.jpg', updated_at = now()
WHERE id = 'green-kenya';

-- Verify: should show exactly the 9 real lots, Kenya with its own photo_url, everyone else NULL.
SELECT id, name, country, photo_url FROM green_beans ORDER BY name ASC;
