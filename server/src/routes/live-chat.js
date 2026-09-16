const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");

const router = express.Router();

// Same real reasoning as feedback.js's own limiter -- a genuinely public, anonymous,
// unauthenticated set of endpoints (no account takeover risk, but still worth real spam
// protection). A real customer's own chat activity is naturally bursty (several messages in a
// short conversation), so this is deliberately looser than feedback's 10/15min -- tuned for "a
// real conversation," not "a single review."
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again in a few minutes." },
});

function publicMessage(row) {
  return { id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at };
}

async function publicChat(row) {
  const messagesResult = await query("SELECT * FROM live_chat_messages WHERE chat_id = $1 ORDER BY created_at ASC", [row.id]);
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status,
    startedAt: row.created_at,
    messages: messagesResult.rows.map(publicMessage),
  };
}

// Starts a real, new, empty conversation -- no message required at creation. Matches the real
// frontend's own actual flow (LiveChatPanel in src/components/index.jsx): startChat() and the
// first sendChatMessage() call are always two separate calls there, in both real paths (a
// signed-in user's auto-started chat, and the manual name/email form) -- the first message is
// always the scripted "agent" greeting text, never something the customer typed at creation time.
// Confirmed directly: an earlier version of this route assumed the creation call always carried
// the customer's own first message, which produced a genuinely wrong sender ("agent" on a
// customer's real first message) the moment this was tested end-to-end against the real frontend
// flow, not just in isolation.
router.post("/", chatLimiter, async (req, res) => {
  const { customerName, customerEmail } = req.body || {};
  if (typeof customerName !== "string" || !customerName.trim() || customerName.length > 120) return res.status(400).json({ error: "customerName is required (max 120 characters)." });
  if (typeof customerEmail !== "string" || !customerEmail.trim() || customerEmail.length > 254) return res.status(400).json({ error: "customerEmail is required (max 254 characters)." });

  const chatResult = await query(
    "INSERT INTO live_chats (customer_name, customer_email) VALUES ($1, $2) RETURNING *",
    [customerName.trim(), customerEmail.trim()]
  );
  res.status(201).json({ chat: await publicChat(chatResult.rows[0]) });
});

// A real message on an existing chat -- always from the customer ("user"). Real agent replies
// only ever come from the dedicated, auth-gated /reply route below; this route can't be used to
// fake one, unlike an earlier version of it which accepted an arbitrary sender from the request
// body. No auth on this route itself (this is the same anonymous widget flow as chat creation),
// but the chat_id (a real UUID, not a guessable sequential id) is effectively the credential
// here, the same trust model a support-ticket link or an unlisted URL already relies on
// elsewhere on the real internet.
router.post("/:id/messages", chatLimiter, async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 2000) return res.status(400).json({ error: "text is required (max 2000 characters)." });

  const chatResult = await query("SELECT * FROM live_chats WHERE id = $1", [req.params.id]);
  const chat = chatResult.rows[0];
  if (!chat) return res.status(404).json({ error: "Chat not found." });

  await query("INSERT INTO live_chat_messages (chat_id, sender, text) VALUES ($1, $2, $3)", [chat.id, "user", text.trim()]);
  res.status(201).json({ chat: await publicChat(chat) });
});

// The one, narrow real exception to "agent messages only come from the auth-gated /reply route":
// the scripted greeting text LiveChatPanel sends immediately after creating a chat, in both real
// paths (a signed-in user's auto-started chat, and the manual name/email form) -- see that
// component's own two real sendChatMessage(id, "agent", ...) call sites. A separate, narrow route
// rather than accepting an arbitrary sender on the general message route above, so there's no
// general "post as agent" capability for an anonymous caller to reach at all -- just this one,
// specific, cosmetic greeting.
router.post("/:id/greeting", chatLimiter, async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 2000) return res.status(400).json({ error: "text is required (max 2000 characters)." });

  const chatResult = await query("SELECT * FROM live_chats WHERE id = $1", [req.params.id]);
  const chat = chatResult.rows[0];
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  // Only ever the very first message on a genuinely brand-new chat -- a real, if defensive, guard
  // against this narrow route being called repeatedly to inject fake "agent" text into an
  // otherwise-real conversation later on.
  const existingResult = await query("SELECT id FROM live_chat_messages WHERE chat_id = $1 LIMIT 1", [chat.id]);
  if (existingResult.rows.length > 0) return res.status(409).json({ error: "This chat already has messages -- the greeting can only be the first one." });

  await query("INSERT INTO live_chat_messages (chat_id, sender, text) VALUES ($1, $2, $3)", [chat.id, "agent", text.trim()]);
  res.status(201).json({ chat: await publicChat(chat) });
});

// Lets the widget check for a real admin's reply without needing real-time push -- the frontend
// polls this on an interval while a chat is open. No auth, same chat_id-as-credential reasoning
// as the message-send route above.
router.get("/:id", chatLimiter, async (req, res) => {
  const chatResult = await query("SELECT * FROM live_chats WHERE id = $1", [req.params.id]);
  const chat = chatResult.rows[0];
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  res.json({ chat: await publicChat(chat) });
});

// Admin-only, sees every real conversation regardless of status -- the real moderation/response
// queue AdminLiveChat (src/admin/index.jsx) already renders, previously fed by in-memory state
// only, now by this.
router.get("/", requireAuth, requirePermission("Live Chat"), async (req, res) => {
  const chatsResult = await query("SELECT * FROM live_chats ORDER BY created_at DESC", []);
  const chats = await Promise.all(chatsResult.rows.map(publicChat));
  res.json({ chats });
});

// A real admin's own reply -- sender is always "agent" here, never trusted from the request body,
// since this route's own auth+permission gate is what makes a message legitimately from staff in
// the first place.
router.post("/:id/reply", requireAuth, requirePermission("Live Chat"), async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 2000) return res.status(400).json({ error: "text is required (max 2000 characters)." });

  const chatResult = await query("SELECT * FROM live_chats WHERE id = $1", [req.params.id]);
  const chat = chatResult.rows[0];
  if (!chat) return res.status(404).json({ error: "Chat not found." });

  await query("INSERT INTO live_chat_messages (chat_id, sender, text) VALUES ($1, $2, $3)", [chat.id, "agent", text.trim()]);
  res.status(201).json({ chat: await publicChat(chat) });
});

router.patch("/:id/status", requireAuth, requirePermission("Live Chat"), async (req, res) => {
  const { status } = req.body || {};
  if (status !== "Open" && status !== "Resolved") return res.status(400).json({ error: 'status must be "Open" or "Resolved".' });
  const result = await query("UPDATE live_chats SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Chat not found." });
  res.json({ chat: await publicChat(result.rows[0]) });
});

module.exports = router;
