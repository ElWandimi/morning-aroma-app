// Regenerates the green bean seed data in migrations/006_green_beans.sql from the real, current
// GREEN_BEANS array in the frontend source -- run this again if that source data ever changes
// before the original migration has run everywhere it needs to. Never hand-edit generated SQL for
// multiple complex records -- that's exactly the kind of task a transcription error slips into.
//
// Usage: node server/scripts/generate-green-bean-seed.mjs > /tmp/seed-output.sql
import { GREEN_BEANS } from "../../src/data/index.js";

function sqlString(val) {
  if (val === undefined || val === null) return "NULL";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

console.log(`-- Generated programmatically from src/data/index.js's GREEN_BEANS array -- do not`);
console.log(`-- hand-edit the values below; regenerate this file if the source data changes before`);
console.log(`-- this migration has been run anywhere.\n`);

for (const g of GREEN_BEANS) {
  const cols = ["id", "name", "country", "roasted_id", "price_per_kg_cents", "stock_kg", "min_order_kg", "cupping_score", "moisture", "grade", "process", "notes"];
  const vals = [
    sqlString(g.id), sqlString(g.name), sqlString(g.country), sqlString(g.roastedId),
    g.pricePerKgCents, g.stockKg, g.minOrderKg, g.cuppingScore,
    sqlString(g.moisture), sqlString(g.grade), sqlString(g.process), sqlString(g.notes),
  ];
  console.log(`INSERT INTO green_beans (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT (id) DO NOTHING;\n`);
}
console.log(`-- Total green beans seeded: ${GREEN_BEANS.length}`);
