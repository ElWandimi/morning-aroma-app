-- Real recurring billing via Paystack's actual Subscriptions API. Paystack owns the billing
-- schedule once a subscription is created (it auto-charges the customer's saved card and notifies
-- this app via webhook) -- this app never charges a card directly for a renewal, only for the
-- very first payment (an ordinary one-time checkout, same as any other order today), which is
-- what gives Paystack the authorization a subscription needs to exist at all.

-- Paystack requires a real Plan object per unique (product, interval, price) combination -- Plans
-- aren't per-subscriber, they're the template a subscription attaches to. Cached here so the
-- first customer subscribing to a given product+interval creates the real Paystack Plan once, and
-- every later subscriber to that same combination reuses it, rather than each customer silently
-- accumulating their own near-duplicate Plan on the real Paystack dashboard.
--
-- amount_kes_cents, not amount_cents -- this app's product prices are stored in USD cents
-- (products.price_cents), but Paystack bills in KES (see paymentVerification.js's own
-- USD->KES conversion for ordinary orders), so the Plan itself has to carry the real, fixed KES
-- amount actually charged, not the USD figure passed through unconverted.
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           TEXT NOT NULL REFERENCES products(id),
  interval             TEXT NOT NULL, -- 'monthly' | 'annually'
  amount_kes_cents      INTEGER NOT NULL, -- locked in at plan-creation time; a later price or
                                          -- exchange-rate change creates a new plan for future
                                          -- subscribers rather than retroactively changing what
                                          -- an existing plan's subscribers are billed
  paystack_plan_code   TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, interval, amount_kes_cents)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id),
  product_id                  TEXT NOT NULL REFERENCES products(id),
  quantity                    INTEGER NOT NULL DEFAULT 1,
  interval                    TEXT NOT NULL, -- 'monthly' | 'annually'
  -- Both kept, not just one -- amount_usd_cents keeps a renewal-generated order consistent with
  -- every other order in this app (orders.total_cents is always USD cents), while
  -- amount_kes_cents is the real, fixed amount Paystack actually bills the customer's card and
  -- the figure a renewal charge's amount is verified against. Both locked in at subscribe time,
  -- same reasoning as subscription_plans above.
  amount_usd_cents             INTEGER NOT NULL,
  amount_kes_cents             INTEGER NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active', -- active | paused | past_due | cancelled
  shipping_name               TEXT NOT NULL,
  shipping_address            TEXT NOT NULL,
  shipping_city                TEXT NOT NULL,
  paystack_customer_code      TEXT NOT NULL,
  paystack_subscription_code  TEXT NOT NULL,
  paystack_email_token        TEXT NOT NULL, -- required by Paystack's own disable/enable
                                              -- endpoints, alongside the subscription code
  next_payment_date           TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- Links a renewal order back to the subscription that generated it -- NULL for every ordinary,
-- non-subscription order (which remains most of them).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);
