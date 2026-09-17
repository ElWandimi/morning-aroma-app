const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// Real, periodic, one-way sync of the customer's own real cart state FROM their browser's
// localStorage (the actual, live cart the app reads from and displays -- this table is never
// read by anything customer-facing, only by the abandoned-cart email job). Called from the
// frontend's own CartProvider on a real interval while signed in, not on every single add/remove
// -- see App.jsx's own comment for why. Upserts, not inserts -- a customer has exactly one real
// cart snapshot, always overwritten with their current, actual state.
router.put("/", requireAuth, async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array." });

  const existingResult = await query("SELECT items, abandoned_email_sent_at FROM cart_snapshots WHERE user_id = $1", [req.user.sub]);
  const existing = existingResult.rows[0];
  // A genuinely different cart from what's already on file (items added/removed/changed since
  // the last sync) resets abandoned_email_sent_at -- this is the real mechanism behind "resend
  // if a NEW abandonment happens later" from this feature's own real design decision: the
  // scheduled job (see abandonedCart.js) only ever considers a cart for emailing when this
  // column is NULL, so a genuinely new state is eligible for a fresh email again, while an
  // unchanged cart being re-synced (the normal, periodic case) doesn't reset anything and stays
  // correctly excluded if it was already emailed.
  //
  // A real, previously-shipped bug this fixes: the SELECT above only ever fetched `items`, not
  // `abandoned_email_sent_at` -- meaning existing?.abandoned_email_sent_at was ALWAYS undefined
  // regardless of the row's real, actual value, so a genuinely unchanged cart's already-sent
  // marker got silently wiped back to null on every single re-sync, not just a genuinely new
  // abandonment. Confirmed directly: a real end-to-end test (re-syncing identical cart contents
  // after manually setting the marker) caught this precisely -- the route's own itemsChanged
  // computation was already correct, but the value it was preserving never existed to begin
  // with.
  const itemsChanged = !existing || JSON.stringify(existing.items) !== JSON.stringify(items);

  await query(
    `INSERT INTO cart_snapshots (user_id, items, updated_at, abandoned_email_sent_at)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (user_id) DO UPDATE SET items = $2, updated_at = now(), abandoned_email_sent_at = $3`,
    [req.user.sub, JSON.stringify(items), itemsChanged ? null : existing?.abandoned_email_sent_at ?? null]
  );
  res.status(204).end();
});

module.exports = router;
