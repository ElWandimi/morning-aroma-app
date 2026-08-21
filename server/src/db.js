const { Pool } = require("pg");

// One shared connection pool for the whole process — this is the correct pattern for pg, not a
// new Pool per request, which would exhaust connections under any real load.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway's internal Postgres connection doesn't need SSL; a lot of managed Postgres providers
  // do. Only turn it on when the connection string signals a provider that requires it, rather
  // than hardcoding one assumption that would break in either direction.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query, pool };
