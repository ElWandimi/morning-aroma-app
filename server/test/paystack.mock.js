// Test-only mock, never shipped or imported by production code. Substitutes for
// server/src/utils/paystack.js's real network calls (this sandbox can't reach api.paystack.co or
// the exchange-rate API any more than it could reach Railway or Postgres directly earlier this
// project) while still exercising the real verification logic in routes/orders.js unmodified.
// Configure the next response(s) via setNextVerifyResponse / setNextRate before each test call.

let nextVerifyResponse = null;
let nextVerifyError = null;
let nextRate = 130; // a plausible, fixed USD->KES rate for predictable test math

function setNextVerifyResponse(data) { nextVerifyResponse = data; nextVerifyError = null; }
function setNextVerifyError(message) { nextVerifyError = message; nextVerifyResponse = null; }
function setNextRate(rate) { nextRate = rate; }

async function verifyTransaction(reference) {
  if (nextVerifyError) { const err = new Error(nextVerifyError); throw err; }
  if (!nextVerifyResponse) throw new Error("Test setup error: call setNextVerifyResponse() before hitting verify-payment in a test.");
  return { reference, ...nextVerifyResponse };
}

async function getUsdToKesRate() {
  return nextRate;
}

module.exports = { verifyTransaction, getUsdToKesRate, setNextVerifyResponse, setNextVerifyError, setNextRate };
