// Test-only adapter, never shipped or imported by production code. Exposes the same
// query(text, params) -> Promise<{rows}> interface as server/src/db.js (the real pg-based one) so
// server/src/routes/auth.js — the actual production code — can be exercised unmodified against a
// real database, just a different one than what production uses.
const { DatabaseSync } = require("node:sqlite");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(path.join(__dirname, "schema.sqlite.sql"), "utf8"));

// The handful of real Postgres/SQLite dialect differences this test setup needs to bridge:
// - $1, $2, ... placeholders -> SQLite's ?
// - Postgres relies on a column DEFAULT (gen_random_uuid()) for id and now() for timestamps;
//   SQLite gets those generated in JS before binding instead, since the test schema doesn't
//   define matching SQLite-side defaults for either.
// - RETURNING * is natively supported by both (confirmed the bundled SQLite version supports it),
//   so that part needs no translation.
async function query(text, params = []) {
  let sql = text;
  // node:sqlite's binding is stricter than pg's -- it won't accept a raw JS Date object the way
  // pg does (pg converts it to a Postgres timestamp automatically). Converting here is purely a
  // test-adapter accommodation; the production code in routes/auth.js passes a Date object
  // directly to query(), unchanged, exactly as it should for the real pg-based db.js.
  let values = params.map((v) => (v instanceof Date ? v.toISOString() : v));

  if (/INSERT INTO users/i.test(sql) && /RETURNING \*/i.test(sql)) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    sql = sql.replace(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)",
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    values = [id, ...values, createdAt];
  } else {
    sql = sql.replace(/\$(\d+)/g, "?").replace(/\bnow\(\)/gi, "datetime('now')");
  }

  const isReturning = /RETURNING/i.test(sql);
  const isSelect = /^\s*SELECT/i.test(sql);
  const stmt = db.prepare(sql.trim());

  if (isSelect || isReturning) {
    const rows = isReturning ? [stmt.get(...values)] : stmt.all(...values);
    return { rows: rows.filter(Boolean) };
  }
  stmt.run(...values);
  return { rows: [] };
}

module.exports = { query };
