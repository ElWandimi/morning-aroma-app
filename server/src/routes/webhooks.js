const express = require("express");
const crypto = require("crypto");
const { query } = require("../db");
const { verifyAndMarkOrderPaid } = require("../utils/paymentVerification");

const router = express.Router();

function requireSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

// Paystack signs the RAW request body with HMAC SHA512, keyed with the account's secret key --
// the same key already used for verifying transactions server-side, not a separate "webhook
// secret". Compares in constant time (crypto.timingSafeEqual) rather than a plain string/===
// compare, so an attacker probing this endpoint can't use response-time differences to guess a
// valid signature byte-by-byte. Requires the genuinely raw, unparsed body -- re-serializing an
// already-JSON-parsed object wouldn't byte-for-byte match what Paystack actually signed (key
// ordering, whitespace can differ), which would incorrectly reject real webhooks. That's the
// entire reason this route is mounted with express.raw() ahead of the global express.json() in
// app.js, rather than after it.
function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  const expected = crypto.createHmac("sha512", requireSecretKey()).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");
  // timingSafeEqual throws if the two buffers are different lengths rather than just returning
  // false -- checking length first, and failing closed if they differ, rather than letting that
  // throw become an unhandled 500 on a security check.
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

// A subscription renewal charge has no pre-existing order waiting for it the way an ordinary
// checkout does -- this creates one from scratch, from the subscription's own saved product,
// quantity, and shipping details, marked paid immediately (the charge has already genuinely
// succeeded by the time this webhook fires, unlike an ordinary order which starts unpaid and is
// verified separately).
async function handleSubscriptionRenewalCharge(chargeData) {
  const customerCode = chargeData.customer && chargeData.customer.customer_code;
  const reference = chargeData.reference;
  if (!customerCode || !reference) {
    console.warn("Paystack webhook: subscription-linked charge.success missing customer_code or reference -- can't process.", JSON.stringify(chargeData));
    return;
  }

  // Idempotency, matching the same real database-level guarantee ordinary orders already have
  // (idx_orders_paystack_reference) -- Paystack can and does redeliver the same event more than
  // once (confirmed directly from their own docs, not assumed), and this reference is only ever
  // meant to settle one order.
  const alreadyProcessed = await query("SELECT id FROM orders WHERE paystack_reference = $1", [reference]);
  if (alreadyProcessed.rows[0]) {
    console.log(`Paystack webhook: subscription renewal charge ${reference} already has an order -- skipping (duplicate delivery).`);
    return;
  }

  // A customer could have more than one active subscription (e.g. two different coffees) --
  // customer_code alone doesn't uniquely identify which one this renewal belongs to, so this
  // narrows further by the real charge amount, which is genuinely specific to one subscription.
  const candidates = await query(
    "SELECT * FROM subscriptions WHERE paystack_customer_code = $1 AND status != 'cancelled'",
    [customerCode]
  );
  const matches = candidates.rows.filter((s) => s.amount_kes_cents === chargeData.amount);
  if (matches.length !== 1) {
    console.warn(
      `Paystack webhook: subscription renewal charge ${reference} for customer ${customerCode} matched ${matches.length} subscriptions (expected exactly 1) -- can't safely process automatically. Needs manual review.`
    );
    return;
  }
  const subscription = matches[0];

  const productResult = await query("SELECT * FROM products WHERE id = $1", [subscription.product_id]);
  const product = productResult.rows[0];
  if (!product) {
    console.warn(`Paystack webhook: subscription renewal charge ${reference} references product ${subscription.product_id}, which no longer exists -- can't create an order. Needs manual review.`);
    return;
  }

  const items = [{ id: product.id, qty: subscription.quantity, unitPriceCents: product.price_cents }];
  const paymentMode = (process.env.PAYSTACK_SECRET_KEY || "").startsWith("sk_live_") ? "live" : "test";

  try {
    const result = await query(
      `INSERT INTO orders (user_id, items, total_cents, shipping_name, shipping_address, shipping_city, status, payment_status, paystack_reference, paid_amount_cents, paid_currency, paid_at, payment_mode, subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'Processing', 'paid', $7, $8, $9, now(), $10, $11) RETURNING *`,
      [
        subscription.user_id, JSON.stringify(items), subscription.amount_usd_cents,
        subscription.shipping_name, subscription.shipping_address, subscription.shipping_city,
        reference, chargeData.amount, chargeData.currency, paymentMode, subscription.id,
      ]
    );
    // Same clamped-at-zero reasoning as an ordinary payment (paymentVerification.js) -- this app
    // doesn't reserve stock ahead of time, so this can't fully prevent going negative on its own,
    // just avoid showing a confusing negative number in Admin when it happens.
    await query("UPDATE products SET stock = CASE WHEN stock - $1 < 0 THEN 0 ELSE stock - $1 END WHERE id = $2", [subscription.quantity, product.id]);
    console.log(`Paystack webhook: subscription renewal charge ${reference} created order #${result.rows[0].order_number} for subscription ${subscription.id}.`);
  } catch (e) {
    if (e.code === "23505") {
      // Same real race as ordinary orders can hit -- another concurrent delivery of this exact
      // event won it first. Not a failure.
      console.log(`Paystack webhook: subscription renewal charge ${reference} -- order already created by a concurrent delivery.`);
      return;
    }
    throw e;
  }
}

router.post("/paystack", async (req, res) => {
  const rawBody = req.body; // a Buffer -- this route is mounted with express.raw(), not express.json()
  const signature = req.headers["x-paystack-signature"];
  // Previously this route logged nothing at all, on any path -- meaning there was no way to ever
  // confirm from Railway's logs whether Paystack had genuinely reached this server, only whether
  // an order's paid status changed (which the frontend's own immediate verify() call could
  // account for on its own, making it impossible to tell the two apart). This one line alone
  // turns "did the webhook fire?" from unanswerable into a real, checkable fact.
  console.log(`Paystack webhook received (signature ${signature ? "present" : "missing"})`);

  if (!isValidSignature(rawBody, signature)) {
    // Deliberately vague to Paystack/whoever's calling this (same principle as every other auth
    // check in this app), but logged here server-side where only the project owner can see it --
    // a real invalid-signature attempt is worth knowing about, an internal detail that shouldn't
    // ever be exposed in the response itself.
    console.warn("Paystack webhook rejected -- invalid signature.");
    return res.status(401).json({ error: "Invalid signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    console.warn("Paystack webhook rejected -- malformed JSON payload.");
    return res.status(400).json({ error: "Malformed payload." });
  }

  // Acknowledge quickly with 200 once the signature is confirmed genuine, even for event types
  // this app doesn't act on -- Paystack retries on anything other than 200, and retrying an event
  // type we're deliberately ignoring would just repeat forever for no reason.
  if (event.event !== "charge.success" && event.event !== "subscription.disable") {
    console.log(`Paystack webhook: ignoring event type "${event.event}" (only acts on charge.success and subscription.disable).`);
    return res.status(200).json({ received: true });
  }

  if (event.event === "subscription.disable") {
    // Real, if uncommon: Paystack disables a subscription itself after repeated failed renewal
    // attempts (see ROADMAP.md -- subscriptions are never retried), or when a customer manages
    // their card directly through Paystack rather than this app. Syncs that back into this app's
    // own record so its status stays true regardless of which side initiated the change. A
    // subscription this app itself paused/cancelled (routes/subscriptions.js) already made this
    // exact same update synchronously -- this UPDATE is then a genuine no-op for that case, not
    // a race with it.
    const subscriptionCode = event.data && event.data.subscription_code;
    if (!subscriptionCode) {
      console.log("Paystack webhook: subscription.disable with no subscription_code -- ignoring.");
      return res.status(200).json({ received: true });
    }
    await query(
      "UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE paystack_subscription_code = $1 AND status != 'cancelled'",
      [subscriptionCode]
    );
    console.log(`Paystack webhook: subscription.disable processed for ${subscriptionCode}.`);
    return res.status(200).json({ received: true });
  }

  // From here on: a real charge.success. Paystack sends this same event for both an ordinary
  // one-time payment and a subscription renewal charge -- the `plan` field (present and non-null
  // only for the latter) is the real, documented way to tell them apart, not something this app
  // is guessing at.
  if (event.data && event.data.plan) {
    await handleSubscriptionRenewalCharge(event.data);
    return res.status(200).json({ received: true });
  }

  const reference = event.data && event.data.reference;
  // This app generates references as `${orderNumber}-${timestamp}`, e.g. "MA-1000-173500..." (see
  // the frontend's Checkout.jsx). Extracting the order number back out to find the right order,
  // since unlike the frontend-triggered verify endpoint, a webhook has no user session to look one
  // up by -- Paystack is calling this directly, not a signed-in customer's browser.
  const match = typeof reference === "string" && reference.match(/^MA-(\d+)-/);
  if (!match) {
    // A reference that doesn't match this app's own format wasn't generated by this checkout --
    // nothing to do, but still acknowledge so Paystack doesn't keep retrying an event we can never
    // act on regardless of how many times it's redelivered.
    console.log(`Paystack webhook: charge.success for a reference this app didn't generate (${reference}) -- ignoring.`);
    return res.status(200).json({ received: true });
  }

  const orderResult = await query("SELECT * FROM orders WHERE order_number = $1", [match[1]]);
  const order = orderResult.rows[0];
  if (!order) {
    console.warn(`Paystack webhook: charge.success referenced order #${match[1]}, but no such order exists.`);
    return res.status(200).json({ received: true }); // same reasoning as above
  }

  const result = await verifyAndMarkOrderPaid(order, reference);
  console.log(`Paystack webhook: processed charge.success for order #${match[1]} -- verified: ${result.ok}${result.ok ? "" : `, reason: ${result.error || "unknown"}`}`);
  // Always 200 once the event has genuinely been processed, whether or not it resulted in marking
  // the order paid -- "already paid" (the normal case: the frontend's own verify call beat this
  // webhook to it) and "genuinely couldn't verify" are both handled outcomes, not delivery
  // failures. A non-200 response here should mean "something on this server actually broke," not
  // "this particular event didn't lead to a state change" -- returning an error status for the
  // latter would make Paystack retry indefinitely for no reason.
  res.status(200).json({ received: true, verified: result.ok });
});

module.exports = router;
