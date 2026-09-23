-- Single-row, JSONB-based table for admin content-editing overrides -- mirrors the existing
-- settings table pattern (007_settings.sql) rather than per-row relational tables, because these
-- are small, low-cardinality keyed patches with no need for individual-row audit/CRUD:
--   moment_overrides:         { [momentId]: { benefit?, description? } }
--   country_history_overrides: { [countryName]: "freeform history text" }
-- Deliberately no column for course overrides -- that mechanism (client-only courseOverrides
-- state in src/context/index.jsx) was already fully superseded by realCourses, the real,
-- backend-persisted Academy course data, and had zero remaining call sites anywhere in the app.
CREATE TABLE IF NOT EXISTS content_overrides (
  id                         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moment_overrides           JSONB NOT NULL DEFAULT '{}',
  country_history_overrides  JSONB NOT NULL DEFAULT '{}',
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
