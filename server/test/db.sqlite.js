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

// Postgres generates order_number from a real sequence (order_number_seq, START 1000); SQLite has
// no equivalent, so this test-only counter stands in for it -- starts at the same value purely so
// test assertions reading a formatted "MA-<number>" look the same shape as they would in
// production, not because the actual number matters for anything.
let nextOrderNumber = 1000;

// The handful of real Postgres/SQLite dialect differences this test setup needs to bridge:
// - $1, $2, ... placeholders -> SQLite's ?
// - Postgres relies on a column DEFAULT (gen_random_uuid()) for id and now() for timestamps;
//   SQLite gets those generated in JS before binding instead, since the test schema doesn't
//   define matching SQLite-side defaults for either.
// - RETURNING * is natively supported by both (confirmed the bundled SQLite version supports it),
//   so that part needs no translation.
async function query(text, params = []) {
  let sql = text;
  // node:sqlite's binding is stricter than pg's -- it won't accept a raw JS Date object or Array
  // the way pg does (pg converts a Date to a Postgres timestamp, and a JS array to a native
  // Postgres TEXT[] array, automatically). Converting here is purely a test-adapter
  // accommodation; the production code in routes/ passes these values straight through
  // unchanged, exactly as it should for the real pg-based db.js.
  let values = params.map((v) => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return JSON.stringify(v);
    return v;
  });

  if (/INSERT INTO users/i.test(sql) && /RETURNING \*/i.test(sql)) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    sql = sql.replace(
      "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)",
      "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    values = [id, ...values, createdAt];
  } else if (/INSERT INTO orders/i.test(sql) && /RETURNING \*/i.test(sql)) {
    const id = crypto.randomUUID();
    const orderNumber = nextOrderNumber++;
    const createdAt = new Date().toISOString();
    sql = sql
      .replace(/\s+/g, " ")
      .replace(
        "INSERT INTO orders (user_id, items, total_cents, shipping_name, shipping_address, shipping_city) VALUES ($1, $2, $3, $4, $5, $6)",
        "INSERT INTO orders (id, order_number, user_id, items, total_cents, shipping_name, shipping_address, shipping_city, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
    values = [id, orderNumber, values[0], values[1], values[2], values[3], values[4], values[5], createdAt];
  } else {
    // Postgres numbered parameters ($1, $2...) are references and can legitimately repeat within
    // a single query (e.g. "stock - $1 < 0 THEN 0 ELSE stock - $1"); SQLite's ? placeholders are
    // strictly positional, each one consuming the next value in the bound array in sequence. A
    // naive $N -> ? replacement silently misaligns every value the moment any query reuses the
    // same parameter more than once -- found this the hard way when a stock-decrement query using
    // $1 twice appeared to run successfully (no error, a real row affected) but silently updated
    // the wrong thing, since SQLite happily bound whatever positional value happened to be at
    // that slot. Expands the values array to match each actual placeholder occurrence, in order,
    // before doing the replacement -- rather than assuming every earlier query in this file
    // happened to only need each $N once, which was true by chance, not by design.
    const paramMatches = [...sql.matchAll(/\$(\d+)/g)];
    if (paramMatches.length > 0) {
      values = paramMatches.map((m) => values[parseInt(m[1], 10) - 1]);
    }
    sql = sql.replace(/\$(\d+)/g, "?").replace(/\bnow\(\)/gi, "datetime('now')");
  }

  const isReturning = /RETURNING/i.test(sql);
  const isSelect = /^\s*SELECT/i.test(sql);
  const stmt = db.prepare(sql.trim());

  // The reverse of the stringify-on-bind above: pg would hand production code a real JS array
  // for a TEXT[] column, or a parsed object/array for a JSONB column, automatically; SQLite gives
  // back the raw JSON string it's actually stored as either way, so parse both back before
  // returning -- otherwise every row coming out of this test adapter would have `permissions`
  // and `items` as strings, when routes/users.js and routes/orders.js (correctly, for
  // production) expect and return real arrays.
  const parseJsonColumns = (row) => {
    for (const col of ["permissions", "items", "tags", "profile", "data", "two_factor_backup_codes"]) {
      if (row && typeof row[col] === "string") {
        try { row[col] = JSON.parse(row[col]); } catch { /* leave as-is if malformed */ }
      }
    }
    return row;
  };

  // SQLite's datetime('now') (used everywhere Postgres's now() got translated above) produces a
  // non-standard string like "2026-08-26 05:13:01" -- space-separated, no timezone. This is
  // genuinely UTC (SQLite's `now` modifier defaults to UTC), but that string shape isn't part of
  // the ECMAScript Date Time String Format, so how `new Date(...)` parses it back is technically
  // engine-dependent, not spec-guaranteed. Found this the hard way: it parsed correctly as UTC on
  // one Node/V8 version and as local time on another, which silently broke every real date-math
  // check (like the order-cancellation window) on whichever machine happened to disagree -- not a
  // logic bug in the actual route code at all, and not reachable in production (Postgres's driver
  // hands back real Date objects directly, no string parsing involved). Converting to a real,
  // unambiguous ISO 8601 UTC string here (append "T"/"Z" the way Postgres's own driver already
  // effectively does) removes that engine-dependence entirely, for every column, present or future
  // -- a generic pattern match rather than a hardcoded list of known timestamp column names, so a
  // newly added datetime column is automatically covered too, not silently exempt until it causes
  // the same bug somewhere else.
  const SQLITE_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  const parseDatetimeColumns = (row) => {
    if (!row) return row;
    for (const key of Object.keys(row)) {
      if (typeof row[key] === "string" && SQLITE_DATETIME.test(row[key])) {
        row[key] = row[key].replace(" ", "T") + "Z";
      }
    }
    return row;
  };

  try {
    if (isSelect || isReturning) {
      const rows = (isReturning ? [stmt.get(...values)] : stmt.all(...values)).map(parseJsonColumns).map(parseDatetimeColumns);
      return { rows: rows.filter(Boolean) };
    }
    stmt.run(...values);
    return { rows: [] };
  } catch (e) {
    // Postgres reports a unique-constraint violation as e.code === "23505"; SQLite reports a
    // completely different shape (message text + errcode 2067). Translated here so production
    // code (which checks e.code === "23505", the real Postgres behavior) is exercised faithfully
    // in tests, rather than needing a SQLite-specific branch inside route logic that will never
    // actually run in production. Wraps both the get/all path (RETURNING clauses go through
    // stmt.get) and the plain run path -- a constraint can be violated by either, depending on
    // whether the query happens to have a RETURNING clause.
    if (e.message && e.message.includes("UNIQUE constraint failed")) {
      const translated = new Error(e.message);
      translated.code = "23505";
      throw translated;
    }
    throw e;
  }
}

module.exports = { query };