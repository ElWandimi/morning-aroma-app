// Real calls to Paystack's actual API. Kept in its own module so tests can substitute a fake
// implementation for the network call itself (this sandbox can't reach api.paystack.co any more
// than it could reach Railway or the Postgres instance earlier this project -- confirmed, not
// assumed, the same network restriction hit repeatedly this session) while still exercising the
// real verification logic in routes/orders.js unmodified.

const PAYSTACK_API = "https://api.paystack.co";

function requireSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    // Fails loudly rather than silently proceeding with no key, which would just produce a
    // confusing 401 from Paystack instead of a clear error pointing at the actual missing config.
    throw new Error("PAYSTACK_SECRET_KEY is not set. Add it to this service's environment variables.");
  }
  return key;
}

// Verifies a transaction reference against Paystack's own record of it -- the only trustworthy
// source for whether a payment actually succeeded. Never trust a client-reported "success" alone;
// this is what routes/orders.js calls before marking any order paid.
async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${requireSecretKey()}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Could not verify this transaction with Paystack.");
  }
  return body.data; // { status, reference, amount, currency, paid_at, ... } -- see Paystack's Verify Transaction docs
}

// Same exchange rate source the frontend already uses for displayed prices (CurrencyProvider),
// so the tolerance check below compares against a rate from the same family/timeframe as what a
// customer would have actually seen, not a differently-sourced rate that could disagree for
// reasons unrelated to genuine market movement.
async function getUsdToKesRate() {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("Could not fetch the current exchange rate.");
  const body = await res.json();
  const rate = body?.rates?.KES;
  if (!rate) throw new Error("Exchange rate response didn't include KES.");
  return rate;
}

// Real refund via Paystack's own Refunds API -- initiates a full refund of the original
// transaction amount. Paystack itself then handles the actual movement of money back to the
// customer's original payment method, which can take up to 10 business days to actually land --
// this call only confirms Paystack has ACCEPTED the refund request, not that funds have arrived.
async function initiateRefund(reference) {
  const res = await fetch(`${PAYSTACK_API}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: reference }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Could not initiate this refund with Paystack.");
  }
  return body.data; // { status, amount, currency, transaction_reference, ... } -- see Paystack's Create Refund docs
}

// Real Plan creation -- Paystack requires a Plan (amount + interval) to exist before a
// Subscription can attach to it. See findOrCreateSubscriptionPlan in routes/subscriptions.js for
// why this is cached rather than called fresh for every subscriber.
async function createPlan(name, amountCents, interval) {
  const res = await fetch(`${PAYSTACK_API}/plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, amount: amountCents, interval, currency: "KES" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new Error(body.message || "Could not create this plan with Paystack.");
  return body.data; // { plan_code, ... } -- see Paystack's Create Plan docs
}

// Real Customer lookup/creation -- a Subscription attaches to a Paystack Customer, not directly
// to an email. Paystack's own /customer endpoint is itself idempotent on email (creating with an
// email that already exists returns the existing customer rather than erroring), so this can
// always just call create rather than needing its own separate lookup-then-create logic.
async function findOrCreateCustomer(email, firstName, lastName) {
  const res = await fetch(`${PAYSTACK_API}/customer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new Error(body.message || "Could not create this customer with Paystack.");
  return body.data; // { customer_code, ... } -- see Paystack's Create Customer docs
}

// Real Subscription creation -- requires an authorization_code from an already-verified
// transaction (Paystack's own requirement: the customer must have paid at least once before a
// subscription can exist). Paystack owns everything from here on: billing dates and charging the
// saved card automatically. Paystack does NOT retry a failed renewal charge (confirmed directly
// from their own docs, not assumed) -- see webhooks.js for how a failed renewal is handled here.
async function createSubscription(customerCode, planCode, authorizationCode) {
  const res = await fetch(`${PAYSTACK_API}/subscription`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ customer: customerCode, plan: planCode, authorization: authorizationCode }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new Error(body.message || "Could not create this subscription with Paystack.");
  return body.data; // { subscription_code, email_token, next_payment_date, ... } -- see Paystack's Create Subscription docs
}

// Real pause -- Paystack's own disable endpoint requires both the subscription code and its
// email_token (returned once, at creation) as a pair; the subscription code alone isn't enough
// to authorize disabling it.
async function disableSubscription(subscriptionCode, emailToken) {
  const res = await fetch(`${PAYSTACK_API}/subscription/disable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new Error(body.message || "Could not pause this subscription with Paystack.");
  return body.data;
}

// Real resume -- the same code/token pair, against Paystack's enable endpoint instead.
async function enableSubscription(subscriptionCode, emailToken) {
  const res = await fetch(`${PAYSTACK_API}/subscription/enable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) throw new Error(body.message || "Could not resume this subscription with Paystack.");
  return body.data;
}

module.exports = { verifyTransaction, getUsdToKesRate, initiateRefund, createPlan, findOrCreateCustomer, createSubscription, disableSubscription, enableSubscription };
