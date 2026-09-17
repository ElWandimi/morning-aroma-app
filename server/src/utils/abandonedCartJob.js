// Real, in-process scheduled job -- not a separate Railway Cron service (a real, deliberate
// tradeoff: simpler to run alongside the existing, already-always-on backend, at the real cost
// that the interval resets on every redeploy, and this WOULD double-fire if this service were
// ever scaled to more than one instance -- confirmed acceptable for this app's current, real,
// single-instance deployment).
//
// Checks for real cart_snapshots rows (see migrations/024_cart_snapshots.sql) that: have real
// items, haven't been updated in over an hour, and haven't already been emailed for their
// current state (abandoned_email_sent_at is NULL -- reset by routes/cart.js's own real sync
// route whenever the cart's actual content changes, which is what makes "resend if a NEW
// abandonment happens later" work correctly).
const { query } = require("../db");
const { sendAbandonedCartEmail } = require("./email");
const { priceForSize, DEFAULT_PRODUCT_SIZE } = require("./pricing");

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes -- frequent enough that "untouched for 1hr+" doesn't drift into 1hr45min in the worst case, infrequent enough not to hammer the database for a check that will usually find nothing.

async function checkForAbandonedCarts() {
  let candidates;
  try {
    // Real, portable SQL: works against both this app's real Postgres (interval arithmetic) and
    // the SQLite test harness, which needed its own translation for this exact query -- see
    // test/db.sqlite.js's own handler for this.
    const result = await query(
      `SELECT cs.user_id, cs.items, u.name, u.email
       FROM cart_snapshots cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.abandoned_email_sent_at IS NULL
         AND cs.updated_at < now() - interval '1 hour'
         AND jsonb_array_length(cs.items) > 0`,
      []
    );
    candidates = result.rows;
  } catch (e) {
    console.error("Abandoned-cart job: failed to query candidates:", e);
    return;
  }

  for (const row of candidates) {
    try {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const ids = [...new Set(items.map((i) => i.id))];
      if (ids.length === 0) continue;
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      const productsResult = await query(`SELECT id, name, price_cents FROM products WHERE id IN (${placeholders}) AND removed = false`, ids);
      const productById = new Map(productsResult.rows.map((p) => [p.id, p]));

      // Real, current items only -- a product that was discontinued or removed since the cart
      // was last synced genuinely shouldn't appear in the email (there'd be nothing to click
      // through to buy). If every item in the cart is gone this way, there's nothing real to
      // email about, so this candidate is skipped entirely rather than sending an empty or
      // misleading email.
      const resolvedItems = items
        .filter((i) => productById.has(i.id))
        .map((i) => {
          const product = productById.get(i.id);
          const size = i.size || DEFAULT_PRODUCT_SIZE;
          return { name: product.name, size, qty: i.qty, unitPriceCents: priceForSize(product.price_cents, size) };
        });
      if (resolvedItems.length === 0) continue;

      const totalCents = resolvedItems.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
      await sendAbandonedCartEmail({ name: row.name, email: row.email }, resolvedItems, totalCents);
      // Marked sent only after the email genuinely succeeds -- if sendEmail throws (a real
      // Resend outage, say), this row stays eligible and gets retried on the next real interval
      // tick, rather than being silently marked "handled" for a send that never actually went
      // out.
      await query("UPDATE cart_snapshots SET abandoned_email_sent_at = now() WHERE user_id = $1", [row.user_id]);
    } catch (e) {
      // One real customer's email failing (a malformed cart snapshot, a transient send error)
      // must never stop the rest of this batch from being processed.
      console.error(`Abandoned-cart job: failed to process user ${row.user_id}:`, e);
    }
  }
}

let intervalHandle = null;

function startAbandonedCartJob() {
  if (intervalHandle) return; // Real, defensive idempotency -- app.js should only ever call this once, but guards against a genuine double-call (e.g. a hot-reload in local dev) silently doubling the real interval.
  intervalHandle = setInterval(checkForAbandonedCarts, CHECK_INTERVAL_MS);
  // Doesn't keep the Node process alive on its own -- a real, deliberate choice so this can't
  // block a clean shutdown/redeploy by itself. Fine here: the actual server (app.listen) is what
  // keeps the process running regardless.
  intervalHandle.unref();
}

module.exports = { startAbandonedCartJob, checkForAbandonedCarts };
