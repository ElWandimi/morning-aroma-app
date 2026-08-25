// Regenerates the settings seed data in migrations/007_settings.sql from the real, current
// DEFAULT_SETTINGS constant in the frontend source -- run this again if that source data ever
// changes before the original migration has run everywhere it needs to. Never hand-edit generated
// SQL -- that's exactly the kind of task a transcription error slips into silently.
//
// Usage: node server/scripts/generate-settings-seed.mjs > /tmp/seed-output.sql
import { DEFAULT_SETTINGS } from "../../src/data/index.js";

function sqlJsonLiteral(val) {
  return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
}

console.log(`-- Generated programmatically from src/data/index.js's DEFAULT_SETTINGS constant --`);
console.log(`-- do not hand-edit the values below; regenerate this file if the source data`);
console.log(`-- changes before this migration has been run anywhere.\n`);
console.log(`INSERT INTO settings (id, data)\nVALUES (1, ${sqlJsonLiteral(DEFAULT_SETTINGS)})\nON CONFLICT (id) DO NOTHING;`);
