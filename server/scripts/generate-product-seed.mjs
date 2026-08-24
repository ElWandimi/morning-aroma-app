// Regenerates the product seed data in migrations/005_products.sql from the real, current
// PRODUCTS array in the frontend source -- run this again (and copy the output into that
// migration, or a new one) if that source data ever changes before the original migration has
// run everywhere it needs to. Never hand-edit generated SQL for 9+ complex nested records --
// that's exactly the kind of task a transcription error slips into silently.
//
// Usage: node server/scripts/generate-product-seed.mjs > /tmp/seed-output.sql
import { PRODUCTS } from "../../src/data/index.js";

function sqlString(val) {
  if (val === undefined || val === null) return "NULL";
  return "'" + String(val).replace(/'/g, "''") + "'";
}
function sqlJson(val) {
  return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
}

console.log(`-- Generated programmatically from src/data/index.js's PRODUCTS array -- do not hand-edit`);
console.log(`-- the values below; regenerate this file if the source data changes before this`);
console.log(`-- migration has been run anywhere.\n`);

for (const p of PRODUCTS) {
  const cols = ["id", "name", "country", "tier", "price_cents", "stock", "note", "tags", "profile", "growing", "brew_guide", "moment_match", "course"];
  const vals = [
    sqlString(p.id), sqlString(p.name), sqlString(p.country), sqlString(p.tier),
    p.priceCents, p.stock, sqlString(p.note), sqlJson(p.tags), sqlJson(p.profile),
    sqlString(p.growing), sqlString(p.brewGuide), sqlString(p.momentMatch), sqlString(p.course),
  ];
  console.log(`INSERT INTO products (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT (id) DO NOTHING;\n`);
}
console.log(`-- Total products seeded: ${PRODUCTS.length}`);
