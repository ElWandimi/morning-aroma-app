const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { verifyTransaction, getUsdToKesRate } = require("../utils/paystack");

const router = express.Router();

const VALID_STATUSES = ["Processing", "Roasting", "Shipped", "Delivered", "Cancelled", "Refunded"];

function publicOrder(row) {
  return {
    id: row.id,
    orderNumber: `MA-${row.order_number}`,
    items: row.items,
    totalCents: row.total_cents,
    shippingName: row.shipping_name,
    shippingAddress: row.shipping_address,
    shippingCity: row.shipping_city,
    status: row.status,
    paymentStatus: row.payment_status,
    paystackReference: row.paystack_reference,
    paidAmountCents: row.paid_amount_cents,
    paidCurrency: row.paid_currency,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    // Only present on the admin listing (joined in there) — a customer's own /orders/mine
    // response has no reason to include their own email back to them on every order.
    ...(row.customer_email ? { customerEmail: row.customer_email, customerName: row.customer_name } : {}),
  };
}

function validateOrderInput(body) {
  const { items, shippingName, shippingAddress, shippingCity } = body || {};

  if (!Array.isArray(items) || items.length === 0) return "Order must include at least one item.";
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) return "Every item needs a valid product id.";
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) return "Item quantities must be whole numbers between 1 and 99.";
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) return "Every item needs a valid price.";
  }
  if (!shippingName || typeof shippingName !== "string" || !shippingName.trim() || shippingName.length > 200) return "A valid shipping name is required.";
  if (!shippingAddress || typeof shippingAddress !== "string" || !shippingAddress.trim() || shippingAddress.length > 500) return "A valid shipping address is required.";
  if (!shippingCity || typeof shippingCity !== "string" || !shippingCity.trim() || shippingCity.length > 200) return "A valid shipping city is required.";
  return null;
}

router.post("/", requireAuth, async (req, res) => {
  const validationError = validateOrderInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { items, shippingName, shippingAddress, shippingCity } = req.body;
  // KNOWN LIMITATION (see server/README.md and ROADMAP.md): recomputes the total from the
  // submitted per-item prices rather than trusting a submitted grand total directly, which
  // blocks the most obvious form of tampering (mismatched items/total) -- but the per-item
  // prices themselves still come from the client, not a real product catalog in this database,
  // because products/pricing haven't been migrated to Postgres yet. Real price integrity needs
  // that migration; this is real order *persistence*, not yet a fully trustworthy checkout.
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);

  const result = await query(
    `INSERT INTO orders (user_id, items, total_cents, shipping_name, shipping_address, shipping_city)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.sub, JSON.stringify(items), totalCents, shippingName.trim(), shippingAddress.trim(), shippingCity.trim()]
  );
  res.status(201).json({ order: publicOrder(result.rows[0]) });
});

router.get("/mine", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [req.user.sub]);
  res.json({ orders: result.rows.map(publicOrder) });
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const result = await query(
    `SELECT orders.*, users.email AS customer_email, users.name AS customer_name
     FROM orders JOIN users ON users.id = orders.user_id
     ORDER BY orders.created_at DESC`,
    []
  );
  res.json({ orders: result.rows.map(publicOrder) });
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  const result = await query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "No order found with that ID." });
  res.json({ order: publicOrder(result.rows[0]) });
});

// Customer self-service cancellation, deliberately a separate, more restricted endpoint from the
// admin status-update above rather than one endpoint with conditional logic based on who's
// calling. Matches the existing frontend's own restriction (see context/index.jsx's cancelOrder):
// only works from Processing, the one stage before roasting begins -- once fulfillment has
// actually started, only admin can change status further, including to Cancelled/Refunded.
router.post("/:id/cancel", requireAuth, async (req, res) => {
  const result = await query(
    "UPDATE orders SET status = 'Cancelled' WHERE id = $1 AND user_id = $2 AND status = 'Processing' RETURNING *",
    [req.params.id, req.user.sub]
  );
  if (!result.rows[0]) {
    return res.status(400).json({ error: "This order can't be cancelled — it may not exist, belong to you, or has already moved past Processing." });
  }
  res.json({ order: publicOrder(result.rows[0]) });
});

// Verifies a Paystack payment and, if genuinely valid, marks the order paid. Never trusts the
// frontend's report of success -- always re-confirms with Paystack directly using the secret key,
// which only this server has.
router.post("/:id/verify-payment", requireAuth, async (req, res) => {
  const { reference } = req.body || {};
  if (!reference || typeof reference !== "string") return res.status(400).json({ error: "A payment reference is required." });

  const orderResult = await query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [req.params.id, req.user.sub]);
  const order = orderResult.rows[0];
  if (!order) return res.status(404).json({ error: "No order found with that ID." });
  if (order.payment_status === "paid") return res.status(400).json({ error: "This order has already been paid." });

  let transaction;
  try {
    transaction = await verifyTransaction(reference);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  if (transaction.status !== "success") {
    return res.status(400).json({ error: `Payment was not successful (status: ${transaction.status}).` });
  }
  if (transaction.currency !== "KES") {
    return res.status(400).json({ error: `Expected a KES payment, got ${transaction.currency}.` });
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
    return res.status(502).json({ error: "Couldn't confirm the exchange rate to verify this payment. Please try again shortly." });
  }
  const tolerance = 0.05;
  const withinTolerance = Math.abs(transaction.amount - expectedKesCents) <= expectedKesCents * tolerance;
  if (!withinTolerance) {
    return res.status(400).json({ error: "The amount paid doesn't match what's owed on this order." });
  }

  // Atomic, race-safe: the WHERE clause re-checks payment_status = 'unpaid' at the moment of the
  // actual write, not just in the SELECT above -- two simultaneous verify calls for the same order
  // (a double-click, a retried request) can't both succeed, since the second one's WHERE clause
  // stops matching the instant the first one's UPDATE commits. The unique index on
  // paystack_reference (see migrations/003_paystack.sql) is the second, database-level layer of
  // the same guarantee: even a reference reused across two different orders can't both succeed.
  let result;
  try {
    result = await query(
      `UPDATE orders SET payment_status = 'paid', paystack_reference = $1, paid_amount_cents = $2, paid_currency = $3, paid_at = now()
       WHERE id = $4 AND user_id = $5 AND payment_status = 'unpaid' RETURNING *`,
      [transaction.reference, transaction.amount, transaction.currency, req.params.id, req.user.sub]
    );
  } catch (e) {
    // Postgres unique_violation -- this specific reference has already settled a different order.
    // Caught explicitly for a clear response rather than falling through to a generic 500, since
    // this is exactly the kind of edge case (a replayed or reused reference) worth a precise
    // answer on a payment-verification path.
    if (e.code === "23505") return res.status(400).json({ error: "This payment reference has already been used for a different order." });
    throw e;
  }
  if (!result.rows[0]) return res.status(400).json({ error: "This order has already been paid." });
  res.json({ order: publicOrder(result.rows[0]) });
});

module.exports = router;
