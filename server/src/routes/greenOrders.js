const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

function publicGreenOrder(row) {
  const createdAtIso = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    message: row.message,
    beanId: row.bean_id,
    beanName: row.bean_name,
    quantityKg: row.quantity_kg,
    pricePerKgCentsAtOrder: row.price_per_kg_cents_at_order,
    totalCents: row.total_cents,
    status: row.status,
    date: createdAtIso.slice(0, 10),
    createdAt: createdAtIso,
  };
}

router.post("/", orderLimiter, async (req, res) => {
  const { name, email, company, message, beanId, quantityKg } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name is required (max 120 characters)." });
  if (typeof email !== "string" || !email.trim() || email.length > 254) return res.status(400).json({ error: "email is required (max 254 characters)." });
  if (typeof beanId !== "string" || !beanId.trim()) return res.status(400).json({ error: "beanId is required." });
  if (typeof quantityKg !== "number" || !Number.isInteger(quantityKg) || quantityKg <= 0) return res.status(400).json({ error: "quantityKg must be a positive whole number." });
  if (company !== undefined && company !== null && (typeof company !== "string" || company.length > 120)) return res.status(400).json({ error: "company must be 120 characters or fewer." });
  if (message !== undefined && message !== null && (typeof message !== "string" || message.length > 1000)) return res.status(400).json({ error: "message must be 1000 characters or fewer." });

  const beanResult = await query("SELECT id, name, price_per_kg_cents, min_order_kg, stock_kg FROM green_beans WHERE id = $1 AND removed = false", [beanId]);
  const bean = beanResult.rows[0];
  if (!bean) return res.status(400).json({ error: "This green coffee lot is no longer available." });
  if (quantityKg < bean.min_order_kg) return res.status(400).json({ error: `Minimum order for this lot is ${bean.min_order_kg}kg.` });
  if (quantityKg > bean.stock_kg) return res.status(400).json({ error: `Only ${bean.stock_kg}kg currently in stock for this lot.` });

  const totalCents = Math.round(bean.price_per_kg_cents * quantityKg);

  const inserted = await query(
    "INSERT INTO green_orders (name, email, company, message, bean_id, bean_name, quantity_kg, price_per_kg_cents_at_order, total_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    [name.trim(), email.trim(), company?.trim() || null, message?.trim() || null, bean.id, bean.name, quantityKg, bean.price_per_kg_cents, totalCents]
  );
  res.status(201).json({ order: publicGreenOrder(inserted.rows[0]) });
});

router.get("/", requireAuth, requirePermission("Green Orders"), async (req, res) => {
  const result = await query("SELECT * FROM green_orders ORDER BY created_at DESC", []);
  res.json({ orders: result.rows.map(publicGreenOrder) });
});

router.patch("/:id/status", requireAuth, requirePermission("Green Orders"), async (req, res) => {
  const { status } = req.body || {};
  if (!["New", "Quoted", "Invoiced", "Shipped", "Fulfilled"].includes(status)) return res.status(400).json({ error: "status must be a real, valid stage." });
  const result = await query("UPDATE green_orders SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Order not found." });
  res.json({ order: publicGreenOrder(result.rows[0]) });
});

module.exports = router;
