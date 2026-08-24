-- Morning Aroma backend — payment mode tracking (real vs test transactions)
-- Run this against the same Postgres database as the earlier migrations, after them.
--
-- Without this, a real transaction (paid with sk_live_...) and a test transaction (paid with
-- sk_test_...) look identical in the orders table once both keys have been used against the same
-- database over time -- both just show payment_status = 'paid' with a KES amount. Once real money
-- is actually involved, that distinction matters for real bookkeeping.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode TEXT;
