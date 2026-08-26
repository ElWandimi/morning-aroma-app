const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { verifyAndMarkOrderPaid } = require("../utils/paymentVerification");
const { initiateRefund } = require("../utils/paystack");
const { sendRefundNeededEmail } = require("../utils/email");

const router = express.Router();

const VALID_STATUSES = ["Processing", "Roasting", "Shipped", "Delivered", "Cancelled", "Refunded"];
// How long after payment a customer can still self-cancel. Chosen as the upper end of a
// reasonable range (5-10 minutes) -- generous enough for a genuine "wrong item, changed my mind"
// moment right after checkout, without staying open so long that fulfillment could reasonably
// have already started.
const CANCELLATION_WINDOW_MINUTES = 10;

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
    paymentMode: row.payment_mode,
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

  // Real price integrity: looks up each item's CURRENT, real price from the products table and
  // uses that for the actual total -- never trusts the client-submitted unitPriceCents for
  // pricing (still validated for shape in validateOrderInput, for backward compatibility with the
  // existing frontend contract and so a malformed value still gets a clear 400, but the value
  // itself is now genuinely ignored). Standard IN (...) with individually numbered placeholders
  // rather than Postgres's ANY($1) array syntax -- keeps this portable across both the real
  // Postgres backend and the SQLite test harness without needing new adapter-specific translation
  // for array parameters, the same reasoning already applied to other queries in this codebase.
  const ids = [...new Set(items.map((i) => i.id))];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const productsResult = await query(`SELECT id, price_cents FROM products WHERE id IN (${placeholders}) AND removed = false`, ids);
  const priceById = new Map(productsResult.rows.map((p) => [p.id, p.price_cents]));

  const unavailable = ids.filter((id) => !priceById.has(id));
  if (unavailable.length > 0) {
    return res.status(400).json({ error: `Some items are no longer available: ${unavailable.join(", ")}` });
  }

  const realItems = items.map((i) => ({ id: i.id, qty: i.qty, unitPriceCents: priceById.get(i.id) }));
  const totalCents = realItems.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);

  const result = await query(
    `INSERT INTO orders (user_id, items, total_cents, shipping_name, shipping_address, shipping_city)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.sub, JSON.stringify(realItems), totalCents, shippingName.trim(), shippingAddress.trim(), shippingCity.trim()]
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
  const orderResult = await query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [req.params.id, req.user.sub]);
  const order = orderResult.rows[0];
  if (!order) {
    return res.status(404).json({ error: "No order found with that ID." });
  }
  if (order.status !== "Processing") {
    return res.status(400).json({ error: "This order can't be cancelled — it's already moved past Processing." });
  }
  // Unpaid orders (an abandoned checkout that never completed payment) can still be cancelled
  // anytime -- there's no real money involved yet, so no window restriction makes sense. A paid
  // order is different: self-cancellation is only available for a limited window after payment,
  // not indefinitely while Processing, since a real refund becomes owed and fulfillment may
  // already be underway past a certain point.
  if (order.payment_status === "paid") {
    const paidAtMs = new Date(order.paid_at).getTime();
    const windowMs = CANCELLATION_WINDOW_MINUTES * 60 * 1000;
    if (Date.now() - paidAtMs > windowMs) {
      return res.status(400).json({
        error: `The ${CANCELLATION_WINDOW_MINUTES}-minute cancellation window for paid orders has passed. Please contact us directly if you still need to cancel this order.`,
      });
    }
  }

  const result = await query(
    "UPDATE orders SET status = 'Cancelled' WHERE id = $1 AND status = 'Processing' RETURNING *",
    [req.params.id]
  );
  if (!result.rows[0]) {
    // Lost a race with something else changing this order's status between the SELECT above and
    // this UPDATE -- rare, but a real possibility, and worth its own honest message rather than
    // silently succeeding on a cancellation that didn't actually happen.
    return res.status(400).json({ error: "This order can't be cancelled — it may have just moved past Processing." });
  }
  const cancelled = result.rows[0];

  if (order.payment_status === "paid") {
    // Restore stock -- these items are no longer being fulfilled. Same portable CASE WHEN
    // pattern as the decrement in paymentVerification.js, though restoring can't itself push
    // stock negative the way decrementing could, so the clamp here is more a consistency
    // convention than a real necessity.
    for (const item of cancelled.items) {
      await query("UPDATE products SET stock = stock + $1 WHERE id = $2", [item.qty, item.id]);
    }

    // A real refund is now owed -- mark it distinctly from "paid" so it's visibly trackable in
    // Admin Orders, and notify every super_admin so someone actually acts on it. Refunds are
    // deliberately a manual, admin-triggered action (POST /:id/refund below), not automatic --
    // notifying is the only mechanism connecting a cancellation to that action actually happening.
    const refundPendingResult = await query(
      "UPDATE orders SET payment_status = 'refund_pending' WHERE id = $1 RETURNING *",
      [cancelled.id]
    );
    const finalOrder = refundPendingResult.rows[0];

    const admins = await query("SELECT email FROM users WHERE role = 'super_admin'", []);
    for (const admin of admins.rows) {
      sendRefundNeededEmail(admin.email, finalOrder).catch((err) => console.error("Failed to send refund-needed notification:", err));
    }

    return res.json({ order: publicOrder(finalOrder) });
  }

  res.json({ order: publicOrder(cancelled) });
});

// Real refund via Paystack's own API, triggered only by a deliberate admin action -- never
// automatic. Requires the order to genuinely be in refund_pending (set by a customer cancellation
// above), not just any paid order, so this can't be used to refund an order that's still being
// legitimately fulfilled.
router.post("/:id/refund", requireAuth, requireAdmin, async (req, res) => {
  const orderResult = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  const order = orderResult.rows[0];
  if (!order) return res.status(404).json({ error: "No order found with that ID." });
  if (order.payment_status !== "refund_pending") {
    return res.status(400).json({ error: "This order isn't awaiting a refund." });
  }
  if (!order.paystack_reference) {
    return res.status(400).json({ error: "This order has no payment reference to refund against." });
  }

  try {
    await initiateRefund(order.paystack_reference);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  const result = await query(
    "UPDATE orders SET payment_status = 'refunded' WHERE id = $1 AND payment_status = 'refund_pending' RETURNING *",
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(400).json({ error: "This order isn't awaiting a refund." });
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

  const result = await verifyAndMarkOrderPaid(order, reference);
  // "Already paid" is genuinely a success from the customer's point of view -- their payment did
  // go through, just possibly confirmed by the webhook a moment before this call got here. Real
  // order data included either way, so the frontend can show the same confirmed-order screen
  // regardless of which path actually confirmed the payment.
  if (result.alreadyPaid) return res.json({ order: publicOrder(result.order) });
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
  res.json({ order: publicOrder(result.order) });
});

module.exports = router;
