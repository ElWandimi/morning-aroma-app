const { query } = require("../db");
const { verifyTransaction, getUsdToKesRate } = require("./paystack");

// The one real verification path -- used by both POST /orders/:id/verify-payment (triggered by
// the frontend right after Paystack's popup closes) and the webhook handler (a second, more
// reliable confirmation that fires even if the customer's browser closes before the frontend call
// ever happens). Deliberately a single shared function rather than two similar-looking
// implementations, so the actual rules for "genuinely paid" can't quietly drift apart between the
// two entry points over time.
//
// Takes an already-fetched order row (each caller is responsible for finding the right one --
// the authenticated route looks it up by id + the calling user; the webhook looks it up by the
// order number embedded in the reference, since there's no user session to scope by) and the
// Paystack reference to verify. Returns { ok, order? } on success, { ok: false, error, status? }
// otherwise -- never throws for an expected rejection, only for a genuine unexpected error.
async function verifyAndMarkOrderPaid(order, reference) {
  if (order.payment_status === "paid") {
    return { ok: false, error: "This order has already been paid." };
  }

  let transaction;
  try {
    transaction = await verifyTransaction(reference);
  } catch (e) {
    return { ok: false, error: e.message, status: 502 };
  }

  if (transaction.status !== "success") {
    return { ok: false, error: `Payment was not successful (status: ${transaction.status}).` };
  }
  if (transaction.currency !== "KES") {
    return { ok: false, error: `Expected a KES payment, got ${transaction.currency}.` };
  }

  // The order's total is locked in USD cents at order-creation time, but the customer actually
  // pays in KES -- exchange rates genuinely move between when an order is placed and when payment
  // completes, so this can't require an exact match the way an internal check normally would.
  // A 5% tolerance is generous enough to absorb ordinary rate drift over a checkout session while
  // still catching real tampering -- paying a fraction of what's owed would land far outside it.
  let expectedKesCents;
  try {
    const rate = await getUsdToKesRate();
    expectedKesCents = Math.round((order.total_cents / 100) * rate * 100);
  } catch (e) {
    return { ok: false, error: "Couldn't confirm the exchange rate to verify this payment. Please try again shortly.", status: 502 };
  }
  const tolerance = 0.05;
  const withinTolerance = Math.abs(transaction.amount - expectedKesCents) <= expectedKesCents * tolerance;
  if (!withinTolerance) {
    return { ok: false, error: "The amount paid doesn't match what's owed on this order." };
  }

  // Atomic, race-safe: the WHERE clause re-checks payment_status = 'unpaid' at the moment of the
  // actual write, not just in an earlier SELECT -- two simultaneous attempts to mark the same
  // order paid (a double-click, a retried request, the frontend call and the webhook both racing
  // to confirm the same real payment) can't both succeed, since the second one's WHERE clause
  // stops matching the instant the first one's UPDATE commits. The unique index on
  // paystack_reference (see migrations/003_paystack.sql) is the second, database-level layer of
  // the same guarantee: even a reference reused across two different orders can't both succeed.
  try {
    const result = await query(
      `UPDATE orders SET payment_status = 'paid', paystack_reference = $1, paid_amount_cents = $2, paid_currency = $3, paid_at = now()
       WHERE id = $4 AND payment_status = 'unpaid' RETURNING *`,
      [transaction.reference, transaction.amount, transaction.currency, order.id]
    );
    if (!result.rows[0]) return { ok: false, error: "This order has already been paid." };
    return { ok: true, order: result.rows[0] };
  } catch (e) {
    // Postgres unique_violation -- this specific reference has already settled a different order.
    // Caught explicitly for a clear response rather than falling through to a generic 500, since
    // this is exactly the kind of edge case (a replayed or reused reference) worth a precise
    // answer on a payment-verification path.
    if (e.code === "23505") return { ok: false, error: "This payment reference has already been used for a different order." };
    throw e;
  }
}

module.exports = { verifyAndMarkOrderPaid };
