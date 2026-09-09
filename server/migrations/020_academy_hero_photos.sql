-- Real course hero photo capability (mirrors courses.instructor_photo_url and
-- products.photo_url exactly) -- until a real photo is uploaded, the frontend falls back to a
-- plain styled div rather than a broken image reference.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS hero_photo_url TEXT;
