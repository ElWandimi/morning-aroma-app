// Test-only mock, never shipped or imported by production code. Substitutes for
// server/src/utils/paystack.js's real network calls (this sandbox can't reach api.paystack.co or
// the exchange-rate API any more than it could reach Railway or Postgres directly earlier this
// project) while still exercising the real verification logic in routes/orders.js unmodified.
// Configure the next response(s) via setNextVerifyResponse / setNextRate before each test call.

let nextVerifyResponse = null;
let nextVerifyError = null;
let nextRate = 130; // a plausible, fixed USD->KES rate for predictable test math
let nextRefundResponse = null;
let nextRefundError = null;

function setNextVerifyResponse(data) { nextVerifyResponse = data; nextVerifyError = null; }
function setNextVerifyError(message) { nextVerifyError = message; nextVerifyResponse = null; }
function setNextRate(rate) { nextRate = rate; }
function setNextRefundResponse(data) { nextRefundResponse = data; nextRefundError = null; }
function setNextRefundError(message) { nextRefundError = message; nextRefundResponse = null; }

async function verifyTransaction(reference) {
  if (nextVerifyError) { const err = new Error(nextVerifyError); throw err; }
  if (!nextVerifyResponse) throw new Error("Test setup error: call setNextVerifyResponse() before hitting verify-payment in a test.");
  return { reference, ...nextVerifyResponse };
}

async function getUsdToKesRate() {
  return nextRate;
}

async function initiateRefund(reference) {
  if (nextRefundError) { const err = new Error(nextRefundError); throw err; }
  if (!nextRefundResponse) throw new Error("Test setup error: call setNextRefundResponse() before hitting refund in a test.");
  return { transaction_reference: reference, ...nextRefundResponse };
}

module.exports = {
  verifyTransaction, getUsdToKesRate, initiateRefund,
  setNextVerifyResponse, setNextVerifyError, setNextRate,
  setNextRefundResponse, setNextRefundError,
};
