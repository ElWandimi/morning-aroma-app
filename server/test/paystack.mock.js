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
let nextPlanResponse = null;
let nextPlanError = null;
let nextCustomerResponse = null;
let nextCustomerError = null;
let nextSubscriptionResponse = null;
let nextSubscriptionError = null;
let nextDisableError = null;
let nextEnableError = null;

function setNextVerifyResponse(data) { nextVerifyResponse = data; nextVerifyError = null; }
function setNextVerifyError(message) { nextVerifyError = message; nextVerifyResponse = null; }
function setNextRate(rate) { nextRate = rate; }
function setNextRefundResponse(data) { nextRefundResponse = data; nextRefundError = null; }
function setNextRefundError(message) { nextRefundError = message; nextRefundResponse = null; }
function setNextPlanResponse(data) { nextPlanResponse = data; nextPlanError = null; }
function setNextPlanError(message) { nextPlanError = message; nextPlanResponse = null; }
function setNextCustomerResponse(data) { nextCustomerResponse = data; nextCustomerError = null; }
function setNextCustomerError(message) { nextCustomerError = message; nextCustomerResponse = null; }
function setNextSubscriptionResponse(data) { nextSubscriptionResponse = data; nextSubscriptionError = null; }
function setNextSubscriptionError(message) { nextSubscriptionError = message; nextSubscriptionResponse = null; }
function setNextDisableError(message) { nextDisableError = message; }
function setNextEnableError(message) { nextEnableError = message; }

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

async function createPlan(name, amountCents, interval) {
  if (nextPlanError) { const err = new Error(nextPlanError); throw err; }
  if (!nextPlanResponse) throw new Error("Test setup error: call setNextPlanResponse() before creating a subscription plan in a test.");
  return { name, amount: amountCents, interval, ...nextPlanResponse };
}

async function findOrCreateCustomer(email, firstName, lastName) {
  if (nextCustomerError) { const err = new Error(nextCustomerError); throw err; }
  if (!nextCustomerResponse) throw new Error("Test setup error: call setNextCustomerResponse() before creating a subscription customer in a test.");
  return { email, first_name: firstName, last_name: lastName, ...nextCustomerResponse };
}

async function createSubscription(customerCode, planCode, authorizationCode) {
  if (nextSubscriptionError) { const err = new Error(nextSubscriptionError); throw err; }
  if (!nextSubscriptionResponse) throw new Error("Test setup error: call setNextSubscriptionResponse() before creating a subscription in a test.");
  return { customer: customerCode, plan: planCode, authorization: authorizationCode, ...nextSubscriptionResponse };
}

async function disableSubscription(subscriptionCode, emailToken) {
  if (nextDisableError) { const err = new Error(nextDisableError); throw err; }
  return { code: subscriptionCode, token: emailToken, status: true };
}

async function enableSubscription(subscriptionCode, emailToken) {
  if (nextEnableError) { const err = new Error(nextEnableError); throw err; }
  return { code: subscriptionCode, token: emailToken, status: true };
}

module.exports = {
  verifyTransaction, getUsdToKesRate, initiateRefund,
  setNextVerifyResponse, setNextVerifyError, setNextRate,
  setNextRefundResponse, setNextRefundError,
  createPlan, findOrCreateCustomer, createSubscription, disableSubscription, enableSubscription,
  setNextPlanResponse, setNextPlanError,
  setNextCustomerResponse, setNextCustomerError,
  setNextSubscriptionResponse, setNextSubscriptionError,
  setNextDisableError, setNextEnableError,
};
