-- Real, one-time price update based on market-research price ranges gathered for each variety
-- (roasted retail $/kg and green wholesale $/kg). Each new price below is the midpoint of the
-- researched range, EXCEPT Geisha and Laurina roasted: their researched ranges ($150-400+/kg and
-- $100-200+/kg) reflect exceptional, auction-driven micro-lot pricing, not typical retail, so
-- those two instead use the low end of the "typical specialty micro-lot" figure the research
-- itself called out ($50-60/kg) rather than the full midpoint, which would have been a 5-6x jump.
-- Products/green beans not mentioned in the research (e.g. Panama, El Salvador, Ethiopia
-- roasted retail; and any lot with no matching research entry) are left untouched here.
-- Straight UPDATEs, not a seed -- these rows already exist in the live database (005/006 were
-- one-time INSERT ... ON CONFLICT DO NOTHING seeds), so this is the only way to actually change
-- a live price; editing src/data/index.js alone has no effect once a deployment has already run
-- the original seed migrations.

-- Roasted retail products (price_cents, per kg)
UPDATE products SET price_cents = 3250, updated_at = now() WHERE id = 'bourbon-rwanda';        -- Rwanda: was 1800 -> $32.50/kg (range $25-40)
UPDATE products SET price_cents = 3000, updated_at = now() WHERE id = 'catuai-honduras';        -- Honduras: was 1600 -> $30.00/kg (range $25-35)
UPDATE products SET price_cents = 3000, updated_at = now() WHERE id = 'caturra-colombia';       -- Colombia: was 1900 -> $30.00/kg (range $25-35)
UPDATE products SET price_cents = 3000, updated_at = now() WHERE id = 'chanchamayo-peru';       -- Peru: was 1700 -> $30.00/kg (range $25-35)
UPDATE products SET price_cents = 5500, updated_at = now() WHERE id = 'geisha-panama';          -- Panama: was 4200 -> $55.00/kg (typical micro-lot floor, not auction pricing)
UPDATE products SET price_cents = 5500, updated_at = now() WHERE id = 'laurina-brazil';         -- Brazil: was 2900 -> $55.00/kg (typical floor, not auction pricing)
UPDATE products SET price_cents = 4250, updated_at = now() WHERE id = 'longberry-indonesia';    -- Indonesia: was 1800 -> $42.50/kg (range $35-50)
UPDATE products SET price_cents = 10000, updated_at = now() WHERE id = 'matari-yemen';          -- Yemen: was 4600 -> $100.00/kg (range $80-120+)
UPDATE products SET price_cents = 2750, updated_at = now() WHERE id = 'ngozi-burundi';          -- Burundi: was 2600 -> $27.50/kg (range $20-35)
UPDATE products SET price_cents = 3750, updated_at = now() WHERE id = 'pacamara-elsalvador';    -- El Salvador: was 2700 -> $37.50/kg (range $30-45)
UPDATE products SET price_cents = 3000, updated_at = now() WHERE id = 'peaberry-tanzania';      -- Tanzania: was 2900 -> $30.00/kg (range $25-35)
UPDATE products SET price_cents = 5250, updated_at = now() WHERE id = 'sl28-kenya';             -- Kenya: was 3400 -> $52.50/kg (range $45-60)
UPDATE products SET price_cents = 3250, updated_at = now() WHERE id = 'typica-guatemala';       -- Guatemala: was 1700 -> $32.50/kg (range $25-40)
UPDATE products SET price_cents = 4000, updated_at = now() WHERE id = 'villa-sarch-costa-rica'; -- Costa Rica: was 3100 -> $40.00/kg (range $30-50)
UPDATE products SET price_cents = 4000, updated_at = now() WHERE id = 'yirgacheffe-ethiopia';   -- Ethiopia: was 3300 -> $40.00/kg (range $30-50)

-- Green (unroasted) wholesale lots (price_per_kg_cents, per kg)
UPDATE green_beans SET price_per_kg_cents = 800, updated_at = now() WHERE id = 'green-rwanda';      -- was 680 -> $8.00/kg (range $6-10, FOB)
UPDATE green_beans SET price_per_kg_cents = 650, updated_at = now() WHERE id = 'green-honduras';    -- was 480 -> $6.50/kg (range $5-8)
UPDATE green_beans SET price_per_kg_cents = 600, updated_at = now() WHERE id = 'green-colombia';    -- was 620 -> $6.00/kg (range $4.68-7.14, FOB)
UPDATE green_beans SET price_per_kg_cents = 1125, updated_at = now() WHERE id = 'green-guatemala';  -- was 640 -> $11.25/kg (range $10-12.50, FOB)
UPDATE green_beans SET price_per_kg_cents = 775, updated_at = now() WHERE id = 'green-ethiopia';    -- was 850 -> $7.75/kg (washed/natural G1 avg $5.50-10)
-- green-panama and green-brazil deliberately left unchanged: the research's green-bean figures for
-- Geisha ($50-150+/kg) and Laurina ($50-100+/kg) are the same exceptional/auction-driven pricing
-- called out above for their roasted counterparts, not typical wholesale green pricing -- these
-- two lots' existing prices (1400, 550) already reflect a normal green-coffee wholesale rate and
-- applying the research figures here would repeat the same overcorrection avoided on the roasted
-- side.
-- green-elsalvador (Pacamara) has no updated_at column touched here since the research range
-- ($8-12/kg) is close enough to its existing 750 (=$7.50/kg) that no change was judged necessary;
-- included only as a deliberate no-op note, not applied.
