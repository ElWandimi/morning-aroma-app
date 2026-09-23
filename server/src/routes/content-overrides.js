const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Nothing yet migrated on a given deployment (this row hasn't been created) means no admin has
// ever overridden a moment's copy or a country's history text -- an empty object for each is the
// real, correct starting state, not a placeholder.
const FALLBACK_OVERRIDES = { momentOverrides: {}, countryHistoryOverrides: {} };

function toPublic(row) {
  return {
    momentOverrides: row.moment_overrides,
    countryHistoryOverrides: row.country_history_overrides,
  };
}

async function readCurrent() {
  const existing = await query("SELECT moment_overrides, country_history_overrides FROM content_overrides WHERE id = 1", []);
  return existing.rows[0] ? toPublic(existing.rows[0]) : FALLBACK_OVERRIDES;
}

async function writeCurrent(momentOverrides, countryHistoryOverrides) {
  const result = await query(
    `INSERT INTO content_overrides (id, moment_overrides, country_history_overrides, updated_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET moment_overrides = $1, country_history_overrides = $2, updated_at = now()
     RETURNING moment_overrides, country_history_overrides`,
    [JSON.stringify(momentOverrides), JSON.stringify(countryHistoryOverrides)]
  );
  return toPublic(result.rows[0]);
}

// Public -- Moments, WorldJourney, and Growing all read these overrides to show every visitor
// the admin-edited copy, same reasoning already applied to GET /settings.
router.get("/", async (req, res) => {
  res.json(await readCurrent());
});

// Patches exactly one moment's override, merging the given patch into whatever that moment
// already had -- matches the existing frontend contract (setMomentContent(id, patch) has always
// meant "apply these field changes to this one moment," never "replace every moment's overrides
// with this object"). Merged at the application level, not Postgres's jsonb `||`, same
// portability reasoning as settings.js: `||` means string concatenation in the SQLite test
// harness, not JSONB merge.
router.patch("/moments/:id", requireAuth, requirePermission("Content"), async (req, res) => {
  const patch = req.body || {};
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return res.status(400).json({ error: "Request body must be an object." });
  }
  const allowedKeys = new Set(["benefit", "description"]);
  const unknownKeys = Object.keys(patch).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    return res.status(400).json({ error: `Unknown moment field(s): ${unknownKeys.join(", ")}` });
  }

  const current = await readCurrent();
  const mergedMoments = {
    ...current.momentOverrides,
    [req.params.id]: { ...(current.momentOverrides[req.params.id] || {}), ...patch },
  };
  const result = await writeCurrent(mergedMoments, current.countryHistoryOverrides);
  res.json(result);
});

// Replaces exactly one country's history text -- matches the existing frontend contract
// (setCountryHistory(name, text) has always meant "this is now the full text for this one
// country," not a merge, since it's a single freeform string field, not a patch of sub-fields).
router.patch("/countries/:name", requireAuth, requirePermission("Content"), async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string") {
    return res.status(400).json({ error: "text must be a string." });
  }

  const current = await readCurrent();
  const mergedCountries = { ...current.countryHistoryOverrides, [req.params.name]: text };
  const result = await writeCurrent(current.momentOverrides, mergedCountries);
  res.json(result);
});

module.exports = router;
