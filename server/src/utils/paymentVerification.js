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
    // Genuinely not a failure -- the payment succeeded, just possibly confirmed by a different
    // caller already (the frontend's own verify() call and this same webhook both exist
    // specifically because either one might be the one that actually gets there first). Includes
    // the real order and a distinct `alreadyPaid` flag so callers can treat this the same as
    // success rather than showing a "payment failed" error for a payment that didn't fail.
    return { ok: false, alreadyPaid: true, order, error: "This order has already been paid." };
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
  //
  // paymentMode: Paystack's test and live keys are entirely separate credentials (sk_test_... vs
  // sk_live_...) -- whichever one is currently configured is the one that actually processed this
  // transaction, so its prefix is a reliable way to record which mode a payment happened in. Once
  // real money is involved, this is the only thing that distinguishes genuine revenue from test
  // transactions sitting in the same table (see migrations/004_payment_mode.sql).
  const paymentMode = (process.env.PAYSTACK_SECRET_KEY || "").startsWith("sk_live_") ? "live" : "test";
  try {
    const result = await query(
      `UPDATE orders SET payment_status = 'paid', paystack_reference = $1, paid_amount_cents = $2, paid_currency = $3, paid_at = now(), payment_mode = $4
       WHERE id = $5 AND payment_status = 'unpaid' RETURNING *`,
      [transaction.reference, transaction.amount, transaction.currency, paymentMode, order.id]
    );
    if (!result.rows[0]) {
      // Same reasoning as the early check above -- not a failure, the other simultaneous caller
      // (frontend verify() call vs. this webhook, most commonly) already won this exact race and
      // marked it paid a moment earlier. Re-fetches rather than reusing the stale `order` param,
      // since that still reflects pre-payment state from before whichever call actually won.
      const refetched = await query("SELECT * FROM orders WHERE id = $1", [order.id]);
      return { ok: false, alreadyPaid: true, order: refetched.rows[0], error: "This order has already been paid." };
    }

    // Decrement real stock now, not at order creation -- an order that's merely created but never
    // paid (an abandoned checkout) must never reduce what's actually available. CASE WHEN rather
    // than Postgres's GREATEST(), which SQLite doesn't support the same way (its MAX() is an
    // aggregate function by default, not the scalar clamp GREATEST() is) -- CASE WHEN is standard
    // SQL, portable across both without new adapter-specific translation. Clamped at zero rather
    // than allowed to go negative -- this app doesn't reserve stock at order-creation time, so two
    // near-simultaneous payments for the last unit can still both succeed; letting stock go
    // negative would be a confusing number to show in Admin for a problem this doesn't attempt to
    // fully prevent anyway.
    for (const item of result.rows[0].items) {
      await query("UPDATE products SET stock = CASE WHEN stock - $1 < 0 THEN 0 ELSE stock - $1 END WHERE id = $2", [item.qty, item.id]);
    }

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
