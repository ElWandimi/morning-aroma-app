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

module.exports = { verifyTransaction, getUsdToKesRate };
