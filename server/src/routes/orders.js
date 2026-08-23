const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requireAdmin } = require("../middleware/requireAdmin");

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

module.exports = router;
