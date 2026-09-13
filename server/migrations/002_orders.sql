-- Morning Aroma backend — orders schema (Tier 2 work, real order persistence)
-- Run this against the same Postgres database as 001_init.sql, after it.

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        BIGINT NOT NULL DEFAULT nextval('order_number_seq') UNIQUE, -- human-facing, shown as MA-<number>
  user_id             UUID NOT NULL REFERENCES users(id),
  items               JSONB NOT NULL,   -- [{ id, qty, size, unitPriceCents }, ...] -- size is one of
                                         -- "375g"/"500g"/"1kg" (see server/src/utils/pricing.js).
                                         -- unitPriceCents is always the real, server-computed price
                                         -- for that size, verified against the live products table
                                         -- at order-creation time (see routes/orders.js) -- never
                                         -- trusted from the client, regardless of what a request sent.
  total_cents         INTEGER NOT NULL,
  shipping_name       TEXT NOT NULL,
  shipping_address    TEXT NOT NULL,
  shipping_city       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Processing', -- Processing | Roasting | Shipped | Delivered | Cancelled | Refunded
  payment_status      TEXT NOT NULL DEFAULT 'unpaid',     -- unpaid | paid | refunded — separate from fulfillment status;
                                                            -- stays 'unpaid' until real payment integration exists (Tier 1)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
