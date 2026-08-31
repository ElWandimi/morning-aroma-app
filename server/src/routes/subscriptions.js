const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");
const {
  verifyTransaction,
  getUsdToKesRate,
  createPlan,
  findOrCreateCustomer,
  createSubscription,
  disableSubscription,
  enableSubscription,
} = require("../utils/paystack");

const router = express.Router();

const VALID_INTERVALS = ["monthly", "annually"];

function publicSubscription(row) {
  return {
    id: row.id,
    productId: row.product_id,
    courseId: row.course_id,
    quantity: row.quantity,
    interval: row.interval,
    amountUsdCents: row.amount_usd_cents,
    amountKesCents: row.amount_kes_cents,
    status: row.status,
    shippingName: row.shipping_name,
    shippingAddress: row.shipping_address,
    shippingCity: row.shipping_city,
    nextPaymentDate: row.next_payment_date,
    createdAt: row.created_at,
  };
}

// Finds the cached Paystack Plan for this exact target (a product OR a course)+interval+KES-price,
// creating a real one via Paystack's API the first time any customer subscribes to this exact
// combination -- see migrations/011_subscriptions.sql and 012_academy.sql for why this is cached
// rather than created fresh per subscriber, and why it's keyed on the KES amount specifically
// (Plans exist in a fixed currency, and this app's real charge currency is KES, not USD).
async function findOrCreateSubscriptionPlan(target, targetType, interval, unitAmountKesCents) {
  const targetColumn = targetType === "product" ? "product_id" : "course_id";
  const existing = await query(
    `SELECT * FROM subscription_plans WHERE ${targetColumn} = $1 AND interval = $2 AND amount_kes_cents = $3`,
    [target.id, interval, unitAmountKesCents]
  );
  if (existing.rows[0]) return existing.rows[0];

  const planName = `${target.name} — ${interval}`;
  const paystackPlan = await createPlan(planName, unitAmountKesCents, interval);
  const inserted = await query(
    `INSERT INTO subscription_plans (${targetColumn}, interval, amount_kes_cents, paystack_plan_code) VALUES ($1, $2, $3, $4) RETURNING *`,
    [target.id, interval, unitAmountKesCents, paystackPlan.plan_code]
  );
  return inserted.rows[0];
}

// Creates a real subscription -- requires a `reference` from a payment the customer just
// completed (an ordinary one-time checkout), which this verifies directly with Paystack (never
// trusting a client-reported success) and extracts the real, reusable authorization from. This is
// the one and only source of the authorization a Paystack subscription needs to exist at all --
// there is no separate "set up a subscription without paying first" path, matching Paystack's own
// real requirement, not a limitation invented here.
router.post("/", requireAuth, async (req, res) => {
  const { reference, productId, courseId, quantity, interval, shippingName, shippingAddress, shippingCity } = req.body || {};

  if (!reference || typeof reference !== "string") return res.status(400).json({ error: "A real, already-completed payment reference is required." });
  if (!productId && !courseId) return res.status(400).json({ error: "Either productId or courseId is required." });
  if (productId && courseId) return res.status(400).json({ error: "Provide either productId or courseId, not both." });
  if (!VALID_INTERVALS.includes(interval)) return res.status(400).json({ error: `interval must be one of: ${VALID_INTERVALS.join(", ")}` });

  const targetType = productId ? "product" : "course";
  let target, qty = 1, unitAmountUsdCents;

  if (targetType === "product") {
    qty = Number(quantity) || 1;
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: "quantity must be a positive whole number." });
    if (!shippingName?.trim() || !shippingAddress?.trim() || !shippingCity?.trim()) {
      return res.status(400).json({ error: "Shipping name, address, and city are all required for a product subscription." });
    }
    const productResult = await query("SELECT * FROM products WHERE id = $1 AND removed = false", [productId]);
    target = productResult.rows[0];
    if (!target) return res.status(400).json({ error: "This product is no longer available." });
    unitAmountUsdCents = target.price_cents * qty;
  } else {
    const courseResult = await query("SELECT * FROM courses WHERE id = $1 AND removed = false", [courseId]);
    target = courseResult.rows[0];
    if (!target) return res.status(400).json({ error: "This course is no longer available." });
    // The real 20% annual discount, applied here where it actually determines what Paystack
    // bills -- not just a number shown on the frontend that the real charge might not match.
    unitAmountUsdCents = interval === "annually" ? Math.round(target.monthly_price_cents * 12 * 0.8) : target.monthly_price_cents;
  }

  let transaction;
  try {
    transaction = await verifyTransaction(reference);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  if (transaction.status !== "success") return res.status(400).json({ error: "That payment wasn't successful." });
  const authorizationCode = transaction.authorization && transaction.authorization.authorization_code;
  if (!authorizationCode) return res.status(400).json({ error: "That payment doesn't have a reusable authorization -- can't set up a subscription from it." });

  const userResult = await query("SELECT * FROM users WHERE id = $1", [req.user.sub]);
  const user = userResult.rows[0];

  // Both products and courses store their real price in USD cents -- but Paystack Plans need a
  // fixed amount in the currency actually being charged, and this app charges in KES (see
  // paymentVerification.js's own exchange-rate conversion for ordinary orders). Converting here,
  // not passing the USD figure straight through as if it were already KES, which would silently
  // and drastically undercharge every subscriber. Rounded to whole KES (Paystack's amount field
  // is in the smallest unit -- cents -- so x100 after rounding) rather than carrying
  // fractional-cent precision that serves no real purpose here.
  let usdToKesRate;
  try {
    usdToKesRate = await getUsdToKesRate();
  } catch (e) {
    return res.status(502).json({ error: "Couldn't confirm the exchange rate to set up this subscription. Please try again shortly." });
  }
  const unitAmountKesCents = Math.round((unitAmountUsdCents / 100) * usdToKesRate) * 100;

  let plan;
  try {
    // Reuses an existing Paystack Plan only when today's converted KES amount happens to exactly
    // match a previously-created one -- since the exchange rate moves daily, this will often
    // create a new Plan rather than reusing one, which is a real, accepted trade-off for a first
    // version, not a bug: every subscription still charges the correct, current amount either
    // way, just with less Plan reuse on Paystack's own dashboard than a rate-rounding scheme
    // could achieve.
    plan = await findOrCreateSubscriptionPlan(target, targetType, interval, unitAmountKesCents);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  let customer;
  try {
    const nameParts = (user.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || user.name || "";
    const lastName = nameParts.slice(1).join(" ");
    customer = await findOrCreateCustomer(user.email, firstName, lastName);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  let paystackSubscription;
  try {
    paystackSubscription = await createSubscription(customer.customer_code, plan.paystack_plan_code, authorizationCode);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  const inserted = await query(
    `INSERT INTO subscriptions (user_id, product_id, course_id, quantity, interval, amount_usd_cents, amount_kes_cents, shipping_name, shipping_address, shipping_city, paystack_customer_code, paystack_subscription_code, paystack_email_token, next_payment_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [
      req.user.sub, productId || null, courseId || null, qty, interval, unitAmountUsdCents, unitAmountKesCents,
      // No real shipping for a course -- always null, never a placeholder string, so
      // publicSubscription and any downstream display code can rely on its actual presence to
      // tell a product subscription from a course one, not just courseId/productId.
      targetType === "product" ? shippingName.trim() : null,
      targetType === "product" ? shippingAddress.trim() : null,
      targetType === "product" ? shippingCity.trim() : null,
      customer.customer_code, paystackSubscription.subscription_code, paystackSubscription.email_token,
      paystackSubscription.next_payment_date || null,
    ]
  );

  res.status(201).json({ subscription: publicSubscription(inserted.rows[0]) });
});

router.get("/mine", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC", [req.user.sub]);
  res.json({ subscriptions: result.rows.map(publicSubscription) });
});

router.post("/:id/pause", requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await query("SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2", [id, req.user.sub]);
  const sub = result.rows[0];
  if (!sub) return res.status(404).json({ error: "Subscription not found." });
  if (sub.status === "cancelled") return res.status(400).json({ error: "This subscription is already cancelled." });
  if (sub.status === "paused") return res.status(400).json({ error: "This subscription is already paused." });

  try {
    await disableSubscription(sub.paystack_subscription_code, sub.paystack_email_token);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  const updated = await query("UPDATE subscriptions SET status = 'paused', updated_at = now() WHERE id = $1 RETURNING *", [id]);
  res.json({ subscription: publicSubscription(updated.rows[0]) });
});

router.post("/:id/resume", requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await query("SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2", [id, req.user.sub]);
  const sub = result.rows[0];
  if (!sub) return res.status(404).json({ error: "Subscription not found." });
  if (sub.status !== "paused") return res.status(400).json({ error: "Only a paused subscription can be resumed." });

  try {
    await enableSubscription(sub.paystack_subscription_code, sub.paystack_email_token);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  const updated = await query("UPDATE subscriptions SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *", [id]);
  res.json({ subscription: publicSubscription(updated.rows[0]) });
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await query("SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2", [id, req.user.sub]);
  const sub = result.rows[0];
  if (!sub) return res.status(404).json({ error: "Subscription not found." });
  if (sub.status === "cancelled") return res.status(400).json({ error: "This subscription is already cancelled." });

  try {
    await disableSubscription(sub.paystack_subscription_code, sub.paystack_email_token);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  const updated = await query("UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *", [id]);
  res.json({ subscription: publicSubscription(updated.rows[0]) });
});

// A one-time, non-recurring purchase granting permanent access to every course, including ones
// added later. Fundamentally not a subscription -- no Paystack Subscription object involved at
// all, just a real, verified one-time payment, same trust boundary as an ordinary order (never
// take a client's word that a payment succeeded).
router.post("/lifetime", requireAuth, async (req, res) => {
  const { reference } = req.body || {};
  if (!reference || typeof reference !== "string") return res.status(400).json({ error: "A real, already-completed payment reference is required." });

  const existing = await query("SELECT id FROM academy_lifetime_access WHERE user_id = $1", [req.user.sub]);
  if (existing.rows[0]) return res.status(400).json({ error: "You already have lifetime access." });

  let transaction;
  try {
    transaction = await verifyTransaction(reference);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  if (transaction.status !== "success") return res.status(400).json({ error: "That payment wasn't successful." });
  if (transaction.currency !== "KES") return res.status(400).json({ error: `Expected a KES payment, got ${transaction.currency}.` });

  const settingsResult = await query("SELECT data FROM settings WHERE id = 1", []);
  // Same real fallback settings.js itself falls back to, for the same reason: if this
  // deployment's settings row somehow doesn't have this key yet, a real, sensible default beats
  // silently treating lifetime access as free.
  const priceUsdCents = (settingsResult.rows[0] && settingsResult.rows[0].data.academyLifetimePriceCents) || 24900;

  // Same 5% exchange-rate tolerance and reasoning as ordinary order verification
  // (paymentVerification.js) -- the price is locked in USD, but the customer pays in KES, and
  // rates genuinely move between when the price was shown and when payment completes.
  let usdToKesRate;
  try {
    usdToKesRate = await getUsdToKesRate();
  } catch (e) {
    return res.status(502).json({ error: "Couldn't confirm the exchange rate to verify this payment. Please try again shortly." });
  }
  const expectedKesCents = Math.round((priceUsdCents / 100) * usdToKesRate * 100);
  const tolerance = 0.05;
  const withinTolerance = Math.abs(transaction.amount - expectedKesCents) <= expectedKesCents * tolerance;
  if (!withinTolerance) return res.status(400).json({ error: "The amount paid doesn't match the current lifetime access price." });

  try {
    const inserted = await query(
      "INSERT INTO academy_lifetime_access (user_id, paystack_reference, amount_usd_cents, amount_kes_cents) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.sub, reference, priceUsdCents, transaction.amount]
    );
    res.status(201).json({ hasLifetimeAccess: true, purchasedAt: inserted.rows[0].purchased_at });
  } catch (e) {
    // Same real race/replay protection as ordinary order verification -- this specific reference
    // has already settled a different purchase.
    if (e.code === "23505") return res.status(400).json({ error: "This payment reference has already been used." });
    throw e;
  }
});

router.get("/lifetime/mine", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM academy_lifetime_access WHERE user_id = $1", [req.user.sub]);
  res.json({ hasLifetimeAccess: !!result.rows[0], purchasedAt: result.rows[0] ? result.rows[0].purchased_at : null });
});

// Read-only admin visibility -- per the real scope decision for this feature, customers
// self-manage their own subscriptions; admin just needs to see what's happening for support
// purposes, not a separate management surface.
router.get("/", requireAuth, requirePermission("Orders"), async (req, res) => {
  // LEFT JOIN against both, not an INNER JOIN against just products -- a subscription's
  // product_id or course_id is one or the other, never both (see the CHECK constraint in
  // migrations/012_academy.sql), so an INNER JOIN on products alone would have silently excluded
  // every real course subscription from this list entirely.
  const result = await query(
    `SELECT s.*, u.email as user_email, u.name as user_name, p.name as product_name, c.name as course_name
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN products p ON p.id = s.product_id
     LEFT JOIN courses c ON c.id = s.course_id
     ORDER BY s.created_at DESC`,
    []
  );
  res.json({
    subscriptions: result.rows.map((row) => ({
      ...publicSubscription(row),
      userEmail: row.user_email,
      userName: row.user_name,
      targetType: row.product_id ? "product" : "course",
      targetName: row.product_name || row.course_name,
    })),
  });
});

module.exports = router;
