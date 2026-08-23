-- Morning Aroma backend — Paystack payment fields (Tier 1 work, real payment integration)
-- Run this against the same Postgres database as 001_init.sql and 002_orders.sql, after both.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_currency TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- A given Paystack reference should only ever settle one order -- this is the actual database-
-- level guarantee against the same successful payment being applied to two different orders,
-- not just an application-level check that could be raced.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders (paystack_reference) WHERE paystack_reference IS NOT NULL;
