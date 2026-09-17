-- Real, backend-persisted cart snapshot, used only for abandoned-cart email detection -- the
-- actual, live shopping cart a customer interacts with still lives in localStorage
-- (src/context/index.jsx's CartProvider), exactly as before; this table is a periodic, one-way
-- sync FROM that real client state, not a second source of truth the app reads from.
--
-- Confirmed directly before building this: carts genuinely never touched the backend at all
-- until now, meaning there was no server-side way to know "who has items sitting in their cart"
-- -- a real, structural gap, not something this migration works around.
--
-- One row per real user (not per session/anonymous visitor -- an abandoned-cart email needs a
-- real, known email address, and this app's own genuinely anonymous guests never provide one
-- unless they at least start real account registration, per the real decision behind this
-- feature: even an unverified email from an abandoned sign-up is emailed).
CREATE TABLE IF NOT EXISTS cart_snapshots (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items              JSONB NOT NULL DEFAULT '[]', -- same real shape as the frontend's own cart items: [{id, size, qty}, ...]
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(), -- real, last-touched time -- what "untouched for 1hr+" is actually measured against
  abandoned_email_sent_at TIMESTAMPTZ -- real, if this cart's current state already got an email; NULL means it hasn't. Reset (see server code) whenever the cart's real content changes, so a genuinely NEW abandonment after the customer came back correctly gets a fresh email, per the real decision behind this feature.
);
