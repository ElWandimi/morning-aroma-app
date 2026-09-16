-- Real, backend-persisted live chat -- was purely in-memory frontend React state before this
-- (src/context/index.jsx's liveChats useState([])), meaning a customer's conversation vanished
-- the moment they closed the tab or reloaded, no real admin ever saw it, and "the agent" replying
-- was a scripted matchCannedResponse() lookup, not a real person -- confirmed directly, there was
-- no backend route for this at all.
--
-- Two real tables, not one -- a chat genuinely has many messages over its lifetime (unlike
-- feedback's simpler one-row-per-submission shape), so messages get their own table rather than a
-- growing JSONB array on the chat row, matching how this schema already models one-to-many
-- elsewhere (orders/order line items are the closer real precedent than feedback here, even
-- though feedback is the closer precedent for the public-submission/admin-moderation route shape).
--
-- Anonymous by design, matching the existing, established UX (the widget asks for name/email
-- once, no account or login required) -- this migration doesn't change that, only makes a real
-- conversation persist and be genuinely visible to a real admin instead of disappearing.
CREATE TABLE IF NOT EXISTS live_chats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Open', -- 'Open' | 'Resolved' -- matches AdminLiveChat's
                                                -- own existing STATUSES list exactly, since that
                                                -- admin UI already exists and expects these values
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        UUID NOT NULL REFERENCES live_chats(id) ON DELETE CASCADE,
  sender         TEXT NOT NULL, -- 'user' | 'agent' -- matches the existing frontend's own
                                 -- m.sender === "user" check exactly
  text           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chats_status ON live_chats (status);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_chat_id ON live_chat_messages (chat_id);
