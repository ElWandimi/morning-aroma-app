// Exercises the real, unmodified production route logic (server/src/routes/auth.js) over real
// HTTP requests against a real (SQLite, for this sandbox) database — not a unit test with mocked
// internals. Swaps only the db module, via Node's require cache, before app.js (and therefore
// auth.js) is ever loaded.
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long-for-testing";
process.env.NODE_ENV = "test";
process.env.PAYSTACK_SECRET_KEY = "sk_test_fake_key_for_testing_only";

const path = require("path");
const dbPath = require.resolve(path.join(__dirname, "../src/db.js"));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: require("./db.sqlite.js") };
const paystackPath = require.resolve(path.join(__dirname, "../src/utils/paystack.js"));
const paystackMock = require("./paystack.mock.js");
require.cache[paystackPath] = { id: paystackPath, filename: paystackPath, loaded: true, exports: paystackMock };
const resendPath = require.resolve("resend");
const resendMock = require("./resend.mock.js");
require.cache[resendPath] = { id: resendPath, filename: resendPath, loaded: true, exports: resendMock };

const app = require("../src/app");
const { query } = require("./db.sqlite.js"); // direct DB access for test setup unreachable via the API (e.g. backdating a timestamp)

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`); }
}

async function main() {
  const server = app.listen(4321);
  const base = "http://localhost:4321";
  const post = (path, body, token) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const get = (path, token) =>
    fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const patch = (path, body, token) =>
    fetch(base + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  console.log("Register:");
  let regLog = "";
  const originalLogForReg = console.log;
  console.log = (...args) => { regLog += args.join(" ") + "\n"; originalLogForReg(...args); };
  const reg = await post("/auth/register", { email: "test@morningaroma.local", password: "correcthorsebattery", name: "Test User" });
  console.log = originalLogForReg;
  check("returns 201", reg.status === 201);
  check("returns a user object with expected shape", reg.body.user && reg.body.user.email === "test@morningaroma.local");
  check("the very first user on an empty database becomes super_admin", reg.body.user && reg.body.user.role === "super_admin");
  check("returns a token", typeof reg.body.token === "string" && reg.body.token.length > 20);
  check("never returns the password hash", !("password_hash" in (reg.body.user || {})) && !("passwordHash" in (reg.body.user || {})));
  check("a welcome email fires on successful registration", regLog.includes("Welcome email to test@morningaroma.local"));
  check("welcome email addresses the user by their actual registered name", regLog.includes("Hi Test User,"));
  const token = reg.body.token;

  console.log("\nSeed test products (real order tests below need real products to check prices against):");
  // Using the real POST /products endpoint, not a direct DB insert -- the same slugify(name-
  // country) logic that generates these ids is exactly what production uses, so this also
  // incidentally re-confirms that logic produces the ids the rest of this suite already expects.
  const seedSl28 = await post("/products", { name: "SL28", country: "Kenya", tier: "premium", priceCents: 1500, stock: 100 }, token);
  check("seed product created", seedSl28.status === 201);
  check("id matches what the rest of this suite expects", seedSl28.body.product && seedSl28.body.product.id === "sl28-kenya");
  const seedGeisha = await post("/products", { name: "Geisha", country: "Panama", tier: "premium", priceCents: 3200, stock: 100 }, token);
  check("second seed product created", seedGeisha.status === 201);
  check("id matches what the rest of this suite expects", seedGeisha.body.product && seedGeisha.body.product.id === "geisha-panama");

  console.log("\nSecond registration (bootstrap should not apply again):");
  const reg2 = await post("/auth/register", { email: "second@morningaroma.local", password: "correcthorsebattery", name: "Second User" });
  check("returns 201", reg2.status === 201);
  check("the second user is a normal customer, not admin", reg2.body.user && reg2.body.user.role === "customer");
  const customerId = reg2.body.user.id;
  const customerToken = reg2.body.token;

  console.log("\nGET /users without a token:");
  const usersNoAuth = await get("/users");
  check("returns 401", usersNoAuth.status === 401);

  console.log("\nGET /users as a non-admin customer:");
  const usersAsCustomer = await get("/users", customerToken);
  check("returns 403, not 401 -- they're authenticated, just not authorized", usersAsCustomer.status === 403);

  console.log("\nGET /users as the real admin:");
  const usersAsAdmin = await get("/users", token);
  check("returns 200", usersAsAdmin.status === 200);
  check("returns both real registered users", Array.isArray(usersAsAdmin.body.users) && usersAsAdmin.body.users.length === 2);
  check("never returns a password hash", usersAsAdmin.body.users.every((u) => !("password_hash" in u) && !("passwordHash" in u)));

  console.log("\nPATCH /users/:id as a non-admin customer:");
  const patchAsCustomer = await patch(`/users/${customerId}`, { role: "staff" }, customerToken);
  check("returns 403", patchAsCustomer.status === 403);

  console.log("\nPATCH /users/:id with an invalid role:");
  const patchBadRole = await patch(`/users/${customerId}`, { role: "supreme-leader" }, token);
  check("returns 400", patchBadRole.status === 400);

  console.log("\nPATCH /users/:id with invalid permissions:");
  const patchBadPerms = await patch(`/users/${customerId}`, { role: "staff", permissions: ["Not A Real Section"] }, token);
  check("returns 400", patchBadPerms.status === 400);

  console.log("\nPATCH /users/:id — promote the customer to staff with real permissions:");
  const promote = await patch(`/users/${customerId}`, { role: "staff", permissions: ["Orders", "Inventory"] }, token);
  check("returns 200", promote.status === 200);
  check("role actually changed", promote.body.user && promote.body.user.role === "staff");
  check("permissions actually saved, in the right shape (a real array, not a JSON string)", Array.isArray(promote.body.user.permissions) && promote.body.user.permissions.includes("Orders") && promote.body.user.permissions.includes("Inventory"));

  console.log("\nPATCH /users/:id — demoting staff back to customer clears their permissions:");
  const demote = await patch(`/users/${customerId}`, { role: "customer" }, token);
  check("returns 200", demote.status === 200);
  check("permissions cleared on demotion", Array.isArray(demote.body.user.permissions) && demote.body.user.permissions.length === 0);

  console.log("\nPATCH /users/:id — refuse to demote the last remaining admin:");
  const adminId = reg.body.user.id;
  const demoteLastAdmin = await patch(`/users/${adminId}`, { role: "customer" }, token);
  check("returns 400, not 200 -- would lock everyone out of the admin dashboard", demoteLastAdmin.status === 400);

  console.log("\nPATCH /users/:id for a non-existent user:");
  const patchMissing = await patch("/users/00000000-0000-0000-0000-000000000000", { role: "staff" }, token);
  check("returns 404", patchMissing.status === 404);

  console.log("\nPOST /orders without a token:");
  const orderNoAuth = await post("/orders", { items: [{ id: "sl28-kenya", qty: 2, unitPriceCents: 1500 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" });
  check("returns 401", orderNoAuth.status === 401);

  console.log("\nPOST /orders with no items:");
  const orderNoItems = await post("/orders", { items: [], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  check("returns 400", orderNoItems.status === 400);

  console.log("\nPOST /orders with an invalid quantity:");
  const orderBadQty = await post("/orders", { items: [{ id: "sl28-kenya", qty: 0, unitPriceCents: 1500 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  check("returns 400", orderBadQty.status === 400);

  console.log("\nPOST /orders missing shipping city:");
  const orderNoCity = await post("/orders", { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 1500 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "" }, customerToken);
  check("returns 400", orderNoCity.status === 400);

  console.log("\nPOST /orders referencing a product that doesn't exist:");
  const orderFakeProduct = await post("/orders", { items: [{ id: "this-product-does-not-exist", qty: 1, unitPriceCents: 1500 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  check("returns 400, not a 500 or a silently-accepted order for a nonexistent product", orderFakeProduct.status === 400);

  console.log("\nPOST /orders referencing a real but discontinued product:");
  const discontinuedProduct = await post("/products", { name: "Discontinued Bean", country: "Nowhereland", tier: "everyday", priceCents: 1000, stock: 5 }, token);
  await fetch(base + `/products/${discontinuedProduct.body.product.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  const orderDiscontinued = await post("/orders", { items: [{ id: discontinuedProduct.body.product.id, qty: 1, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  check("a real product that's been discontinued since can no longer be ordered", orderDiscontinued.status === 400);

  console.log("\nPOST /orders — a real, valid order:");
  const order = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 2, unitPriceCents: 1500 }, { id: "geisha-panama", qty: 1, unitPriceCents: 3200 }], shippingName: "Second User", shippingAddress: "123 Coffee St", shippingCity: "Nairobi" },
    customerToken
  );
  check("returns 201", order.status === 201);
  check("total is genuinely recalculated server-side from the line items (2×1500 + 1×3200 = 6200), not just echoed back", order.body.order && order.body.order.totalCents === 6200);
  check("order number is formatted MA-<number>", order.body.order && /^MA-\d+$/.test(order.body.order.orderNumber));
  check("defaults to Processing / unpaid", order.body.order && order.body.order.status === "Processing" && order.body.order.paymentStatus === "unpaid");
  const orderId = order.body.order.id;

  console.log("\nGET /orders/mine as the customer who placed it:");
  const mine = await get("/orders/mine", customerToken);
  check("returns 200", mine.status === 200);
  check("returns exactly the order just placed", mine.body.orders && mine.body.orders.length === 1 && mine.body.orders[0].id === orderId);

  console.log("\nGET /orders as a non-admin:");
  const allOrdersAsCustomer = await get("/orders", customerToken);
  check("returns 403", allOrdersAsCustomer.status === 403);

  console.log("\nGET /orders as admin — sees every order with customer info attached:");
  const allOrders = await get("/orders", token);
  check("returns 200", allOrders.status === 200);
  check("includes the order with the customer's real email attached", allOrders.body.orders.some((o) => o.id === orderId && o.customerEmail === "second@morningaroma.local"));

  console.log("\nPATCH /orders/:id/status as a non-admin:");
  const statusAsCustomer = await patch(`/orders/${orderId}/status`, { status: "Shipped" }, customerToken);
  check("returns 403", statusAsCustomer.status === 403);

  console.log("\nPATCH /orders/:id/status with an invalid status:");
  const statusBad = await patch(`/orders/${orderId}/status`, { status: "Teleporting" }, token);
  check("returns 400", statusBad.status === 400);

  console.log("\nPATCH /orders/:id/status — admin moves it to Roasting:");
  const statusOk = await patch(`/orders/${orderId}/status`, { status: "Roasting" }, token);
  check("returns 200", statusOk.status === 200);
  check("status actually changed", statusOk.body.order && statusOk.body.order.status === "Roasting");

  console.log("\nPOST /orders/:id/cancel once it's past Processing:");
  const cancelTooLate = await post(`/orders/${orderId}/cancel`, {}, customerToken);
  check("returns 400 -- can't self-cancel once roasting has started", cancelTooLate.status === 400);

  console.log("\nPOST /orders/:id/cancel on someone else's order:");
  const secondOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 1500 }], shippingName: "Test User", shippingAddress: "456 Bean Ave", shippingCity: "Nairobi" },
    token // placed by the admin account, not the customer
  );
  const cancelWrongOwner = await post(`/orders/${secondOrder.body.order.id}/cancel`, {}, customerToken);
  check("returns 404 -- same as verify-payment, not leaking that the order exists but belongs to someone else", cancelWrongOwner.status === 404);

  console.log("\nPOST /orders/:id/cancel on your own order while still Processing:");
  const cancelOk = await post(`/orders/${secondOrder.body.order.id}/cancel`, {}, token);
  check("returns 200", cancelOk.status === 200);
  check("status is now Cancelled", cancelOk.body.order && cancelOk.body.order.status === "Cancelled");

  console.log("\nCancelling a PAID order within the window -- the real new behavior:");
  const cancelProduct = await post("/products", { name: "Cancel Test Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 20 }, token);
  const cancelProductId = cancelProduct.body.product.id;
  const cancelPaidOrder = await post("/orders", { items: [{ id: cancelProductId, qty: 4, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const cancelPaidReference = `MA-${cancelPaidOrder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 4 * 1000 / 100 * 130 * 100 });
  await post(`/orders/${cancelPaidOrder.body.order.id}/verify-payment`, { reference: cancelPaidReference }, customerToken);
  resendMock.resetSentEmails();
  process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";

  const stockBeforeCancel = (await get("/products")).body.products.find((p) => p.id === cancelProductId).stock;
  const cancelPaidResult = await post(`/orders/${cancelPaidOrder.body.order.id}/cancel`, {}, customerToken);
  check("returns 200 -- still within the 10-minute window, just paid moments ago", cancelPaidResult.status === 200);
  check("payment status becomes refund_pending, not just Cancelled -- a real refund is now owed", cancelPaidResult.body.order && cancelPaidResult.body.order.paymentStatus === "refund_pending");
  check("fulfillment status is Cancelled", cancelPaidResult.body.order && cancelPaidResult.body.order.status === "Cancelled");

  const stockAfterCancel = (await get("/products")).body.products.find((p) => p.id === cancelProductId).stock;
  check("stock was genuinely restored -- these items are no longer being fulfilled", stockAfterCancel === stockBeforeCancel + 4);

  const refundEmails = resendMock.getSentEmails();
  check("the super_admin was actually emailed about the refund needed, not just a silent status change", refundEmails.length >= 1 && refundEmails.some((e) => e.subject.includes("Refund needed")));
  delete process.env.RESEND_API_KEY;

  console.log("\nCancelling a PAID order OUTSIDE the window is rejected:");
  const expiredProduct = await post("/products", { name: "Expired Window Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 10 }, token);
  const expiredOrder = await post("/orders", { items: [{ id: expiredProduct.body.product.id, qty: 1, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const expiredReference = `MA-${expiredOrder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 1000 / 100 * 130 * 100 });
  await post(`/orders/${expiredOrder.body.order.id}/verify-payment`, { reference: expiredReference }, customerToken);
  // Backdating paid_at directly -- there's no real way to wait 11 real minutes in a test, and no
  // reason production code should expose a way to fake the clock just to make this testable.
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  await query("UPDATE orders SET paid_at = $1 WHERE id = $2", [elevenMinutesAgo, expiredOrder.body.order.id]);
  const expiredCancelResult = await post(`/orders/${expiredOrder.body.order.id}/cancel`, {}, customerToken);
  check("returns 400 -- the window has genuinely passed", expiredCancelResult.status === 400);
  const stillPaid = await get("/orders/mine", customerToken);
  const stillPaidOrder = stillPaid.body.orders.find((o) => o.id === expiredOrder.body.order.id);
  check("order genuinely wasn't touched -- still paid and Processing, not left in a half-cancelled state", stillPaidOrder && stillPaidOrder.status === "Processing" && stillPaidOrder.paymentStatus === "paid");

  console.log("\nPOST /orders/:id/refund as a non-admin:");
  const refundAsCustomer = await post(`/orders/${cancelPaidOrder.body.order.id}/refund`, {}, customerToken);
  check("returns 403", refundAsCustomer.status === 403);

  console.log("\nPOST /orders/:id/refund for an order that isn't awaiting one:");
  const refundNotPending = await post(`/orders/${expiredOrder.body.order.id}/refund`, {}, token);
  check("returns 400 -- this order's payment_status is 'paid', not 'refund_pending'", refundNotPending.status === 400);

  console.log("\nPOST /orders/:id/refund — the real, successful case:");
  paystackMock.setNextRefundResponse({ status: "pending", amount: 4 * 1000, currency: "KES" });
  const refundOk = await post(`/orders/${cancelPaidOrder.body.order.id}/refund`, {}, token);
  check("returns 200", refundOk.status === 200);
  check("payment status is now genuinely refunded", refundOk.body.order && refundOk.body.order.paymentStatus === "refunded");

  console.log("\nPOST /orders/:id/refund when Paystack itself rejects the refund:");
  const secondCancelProduct = await post("/products", { name: "Second Cancel Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 10 }, token);
  const secondCancelOrder = await post("/orders", { items: [{ id: secondCancelProduct.body.product.id, qty: 1, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const secondCancelReference = `MA-${secondCancelOrder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 1000 / 100 * 130 * 100 });
  await post(`/orders/${secondCancelOrder.body.order.id}/verify-payment`, { reference: secondCancelReference }, customerToken);
  await post(`/orders/${secondCancelOrder.body.order.id}/cancel`, {}, customerToken);
  paystackMock.setNextRefundError("Simulated Paystack outage");
  const refundFails = await post(`/orders/${secondCancelOrder.body.order.id}/refund`, {}, token);
  check("returns 502, a real upstream failure -- not silently marked refunded anyway", refundFails.status === 502);
  const stillPendingAfterFailure = await get("/orders/mine", customerToken);
  const stillPendingOrder = stillPendingAfterFailure.body.orders.find((o) => o.id === secondCancelOrder.body.order.id);
  check("order genuinely stays refund_pending -- a failed Paystack call must never be silently treated as success", stillPendingOrder && stillPendingOrder.paymentStatus === "refund_pending");

  // orderId's order totals 6200 cents ($62.00). At the mock's fixed rate (130 KES/USD), the
  // expected charge is 62 * 130 * 100 = 806000 KES cents.
  console.log("\nPOST /orders/:id/verify-payment without a token:");
  const verifyNoAuth = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_1" });
  check("returns 401", verifyNoAuth.status === 401);

  console.log("\nPOST /orders/:id/verify-payment for someone else's order:");
  const verifyWrongOwner = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_1" }, token); // token is the admin, not the customer who owns orderId
  check("returns 404 -- not leaking that the order exists but belongs to someone else", verifyWrongOwner.status === 404);

  console.log("\nPOST /orders/:id/verify-payment with no reference:");
  const verifyNoRef = await post(`/orders/${orderId}/verify-payment`, {}, customerToken);
  check("returns 400", verifyNoRef.status === 400);

  console.log("\nPOST /orders/:id/verify-payment — Paystack reports the transaction failed:");
  paystackMock.setNextVerifyResponse({ status: "failed", currency: "KES", amount: 806000 });
  const verifyFailed = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_failed" }, customerToken);
  check("returns 400", verifyFailed.status === 400);

  console.log("\nPOST /orders/:id/verify-payment — wrong currency:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "NGN", amount: 806000 });
  const verifyWrongCurrency = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_wrong_currency" }, customerToken);
  check("returns 400", verifyWrongCurrency.status === 400);

  console.log("\nPOST /orders/:id/verify-payment — amount way outside tolerance (tampering):");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 1000 }); // paid ~10 KES against an 8,060 KES order
  const verifyTampered = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_tampered" }, customerToken);
  check("returns 400", verifyTampered.status === 400);

  console.log("\nPOST /orders/:id/verify-payment — a genuine, correct payment:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 806000 });
  const verifyOk = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_real_payment" }, customerToken);
  check("returns 200", verifyOk.status === 200);
  check("order is now marked paid", verifyOk.body.order && verifyOk.body.order.paymentStatus === "paid");
  check("real paystack reference stored", verifyOk.body.order && verifyOk.body.order.paystackReference === "ref_real_payment");
  check("actual paid amount/currency stored, not just the expected ones", verifyOk.body.order && verifyOk.body.order.paidAmountCents === 806000 && verifyOk.body.order.paidCurrency === "KES");

  console.log("\nPOST /orders/:id/verify-payment — trying to pay the same order again:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 806000 });
  const verifyAgain = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_second_attempt" }, customerToken);
  check("returns 400 -- already paid", verifyAgain.status === 400);

  console.log("\nPOST /orders/:id/verify-payment — reusing a reference that already paid a different order:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 13000 }); // exact match for the $1.00 order below (100 cents * 130 rate)
  const thirdOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 100 }], shippingName: "Second User", shippingAddress: "123 Coffee St", shippingCity: "Nairobi" },
    customerToken
  );
  const verifyReusedRef = await post(`/orders/${thirdOrder.body.order.id}/verify-payment`, { reference: "ref_real_payment" }, customerToken);
  check("returns 400 -- this reference already settled a different order", verifyReusedRef.status === 400);

  console.log("\nWebhooks — real HMAC signature verification:");
  const crypto = require("crypto");
  const signBody = (bodyString) => crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(bodyString).digest("hex");
  const postWebhook = (bodyString, signature) =>
    fetch(base + "/webhooks/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(signature !== undefined ? { "x-paystack-signature": signature } : {}) },
      body: bodyString,
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  const fakePayload = JSON.stringify({ event: "charge.success", data: { reference: "MA-9999-123", status: "success" } });

  const webhookNoSig = await postWebhook(fakePayload, undefined);
  check("missing signature header is rejected", webhookNoSig.status === 401);

  const webhookBadSig = await postWebhook(fakePayload, "not-a-real-signature-at-all-000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
  check("wrong signature is rejected -- this is the core defense against a forged 'payment succeeded' event", webhookBadSig.status === 401);

  const webhookRightSigWrongBody = await postWebhook(fakePayload + " ", signBody(fakePayload));
  check("signature computed over a different body than what's actually sent is rejected -- confirms this checks the real bytes, not just 'a signature was present'", webhookRightSigWrongBody.status === 401);

  const webhookIgnoredEvent = await postWebhook(
    JSON.stringify({ event: "transfer.success", data: { reference: "MA-9999-123" } }),
    signBody(JSON.stringify({ event: "transfer.success", data: { reference: "MA-9999-123" } }))
  );
  check("a genuinely signed event of a type this app doesn't act on is still acknowledged with 200 -- Paystack retries anything else, forever, for no benefit", webhookIgnoredEvent.status === 200);

  const webhookUnknownRef = JSON.stringify({ event: "charge.success", data: { reference: "MA-99999999-000", status: "success", currency: "KES", amount: 1 } });
  const webhookNoMatchingOrder = await postWebhook(webhookUnknownRef, signBody(webhookUnknownRef));
  check("a well-formed reference for an order that doesn't exist is still acknowledged with 200, not an error", webhookNoMatchingOrder.status === 200);

  console.log("\nWebhook as the ONLY confirmation path (simulating a customer closing the tab right after paying):");
  const webhookOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 3, unitPriceCents: 1000 }], shippingName: "Second User", shippingAddress: "123 Coffee St", shippingCity: "Nairobi" },
    customerToken
  );
  // The submitted unitPriceCents (1000) is deliberately wrong here, to also confirm the server
  // genuinely ignores it -- real price integrity means the actual total uses sl28-kenya's real
  // seeded price (1500), not whatever the client sent: 3 * 1500 = 4500 cents ($45.00). At the
  // mock's fixed 130 KES/USD rate, expected = 45 * 130 * 100 = 585000 KES cents.
  check("order total genuinely computed from the real catalog price, not the deliberately-wrong submitted one", webhookOrder.body.order && webhookOrder.body.order.totalCents === 4500);
  const webhookOrderNumber = webhookOrder.body.order.orderNumber.replace("MA-", "");
  const webhookReference = `MA-${webhookOrderNumber}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 585000 });
  const webhookPayload = JSON.stringify({ event: "charge.success", data: { reference: webhookReference, status: "success" } });
  const webhookSuccess = await postWebhook(webhookPayload, signBody(webhookPayload));
  check("returns 200", webhookSuccess.status === 200);
  check("webhook body confirms it genuinely verified and marked the order paid", webhookSuccess.body.verified === true);

  const orderAfterWebhook = await get(`/orders/mine`, customerToken);
  const foundAfterWebhook = orderAfterWebhook.body.orders.find((o) => o.id === webhookOrder.body.order.id);
  check("the order is genuinely marked paid in the database -- not just a 200 response, an actual state change with no frontend verify-payment call ever involved", foundAfterWebhook && foundAfterWebhook.paymentStatus === "paid");
  check("the real paystack reference from the webhook payload was stored", foundAfterWebhook && foundAfterWebhook.paystackReference === webhookReference);
  check("correctly recorded as a test-mode payment, since this whole suite runs under a sk_test_ key", foundAfterWebhook && foundAfterWebhook.paymentMode === "test");

  console.log("\nPayment mode detection actually distinguishes live from test, not just defaulting to one value:");
  const liveModeOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 500 }], shippingName: "Second User", shippingAddress: "123 Coffee St", shippingCity: "Nairobi" },
    customerToken
  );
  // Same deliberately-wrong submitted price as above -- real total is sl28-kenya's real seeded
  // price (1500 cents, $15.00). At the mock's 130 rate = 15 * 130 * 100 = 195000 KES cents.
  const liveModeOrderNumber = liveModeOrder.body.order.orderNumber.replace("MA-", "");
  const liveModeReference = `MA-${liveModeOrderNumber}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000 });
  const previousKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "sk_live_fake_key_simulating_a_real_live_key_for_this_one_check";
  const liveModeVerify = await post(`/orders/${liveModeOrder.body.order.id}/verify-payment`, { reference: liveModeReference }, customerToken);
  process.env.PAYSTACK_SECRET_KEY = previousKey; // restored immediately, so no other test in this suite is affected
  check("payment still verifies correctly under a live-shaped key", liveModeVerify.status === 200);
  check("correctly recorded as live, not defaulted to test", liveModeVerify.body.order && liveModeVerify.body.order.paymentMode === "live");

  console.log("\nWebhook idempotency -- Paystack redelivering the same already-processed event:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 390000 });
  const webhookRedelivered = await postWebhook(webhookPayload, signBody(webhookPayload));
  check("a redelivered webhook for an already-paid order still returns 200 (Paystack shouldn't keep retrying)", webhookRedelivered.status === 200);
  check("but correctly reports it did NOT re-verify/re-process -- the order was already paid, not paid twice", webhookRedelivered.body.verified === false);

  console.log("\nGET /products — public, no auth needed:");
  const productsNoAuth = await get("/products");
  check("returns 200 without any token", productsNoAuth.status === 200);
  check("returns an array", Array.isArray(productsNoAuth.body.products));

  console.log("\nPOST /products without a token:");
  const createNoAuth = await post("/products", { name: "Test Bean", country: "Testland", tier: "everyday", priceCents: 1000, stock: 10 });
  check("returns 401", createNoAuth.status === 401);

  console.log("\nPOST /products as a non-admin:");
  const createAsCustomer = await post("/products", { name: "Test Bean", country: "Testland", tier: "everyday", priceCents: 1000, stock: 10 }, customerToken);
  check("returns 403", createAsCustomer.status === 403);

  console.log("\nPOST /products with an invalid tier:");
  const createBadTier = await post("/products", { name: "Test Bean", country: "Testland", tier: "luxury", priceCents: 1000, stock: 10 }, token);
  check("returns 400", createBadTier.status === 400);

  console.log("\nPOST /products with a negative price:");
  const createBadPrice = await post("/products", { name: "Test Bean", country: "Testland", tier: "everyday", priceCents: -500, stock: 10 }, token);
  check("returns 400", createBadPrice.status === 400);

  console.log("\nPOST /products — a real, valid product:");
  const createOk = await post("/products", {
    name: "Test Bean", country: "Testland", tier: "everyday", priceCents: 1500, stock: 25,
    note: "A test coffee", tags: { aroma: ["nutty"], body: "medium" }, profile: { aroma: 5, body: 5 },
  }, token);
  check("returns 201", createOk.status === 201);
  check("id is generated as a slug from name + country, matching the frontend's own slugify exactly", createOk.body.product && createOk.body.product.id === "test-bean-testland");
  check("nested tags object round-trips correctly, not flattened or lost", createOk.body.product && createOk.body.product.tags && createOk.body.product.tags.aroma && createOk.body.product.tags.aroma[0] === "nutty");
  const testProductId = createOk.body.product.id;

  console.log("\nPOST /products with the same name + country again:");
  const createDup = await post("/products", { name: "Test Bean", country: "Testland", tier: "everyday", priceCents: 1500, stock: 25 }, token);
  check("returns 409", createDup.status === 409);

  console.log("\nGET /products now includes the new product:");
  const productsAfterCreate = await get("/products");
  check("the new product appears in the public list", productsAfterCreate.body.products.some((p) => p.id === testProductId));

  console.log("\nPATCH /products/:id without a token:");
  const productPatchNoAuth = await patch(`/products/${testProductId}`, { priceCents: 2000 });
  check("returns 401", productPatchNoAuth.status === 401);

  console.log("\nPATCH /products/:id as a non-admin:");
  const productPatchAsCustomer = await patch(`/products/${testProductId}`, { priceCents: 2000 }, customerToken);
  check("returns 403", productPatchAsCustomer.status === 403);

  console.log("\nPATCH /products/:id — a real, partial price-only update:");
  const patchPriceOnly = await patch(`/products/${testProductId}`, { priceCents: 2000 }, token);
  check("returns 200", patchPriceOnly.status === 200);
  check("price actually changed", patchPriceOnly.body.product && patchPriceOnly.body.product.priceCents === 2000);
  check("fields NOT included in the request are left untouched -- name wasn't sent, but is still there", patchPriceOnly.body.product && patchPriceOnly.body.product.name === "Test Bean");
  check("stock wasn't sent either, and is also still correct", patchPriceOnly.body.product && patchPriceOnly.body.product.stock === 25);

  console.log("\nPATCH /products/:id for a nonexistent product:");
  const patchMissing404 = await patch("/products/this-id-does-not-exist", { priceCents: 100 }, token);
  check("returns 404", patchMissing404.status === 404);

  console.log("\nDELETE /products/:id as a non-admin:");
  const deleteAsCustomer = await fetch(base + `/products/${testProductId}`, { method: "DELETE", headers: { Authorization: `Bearer ${customerToken}` } });
  check("returns 403", deleteAsCustomer.status === 403);

  console.log("\nDELETE /products/:id — real soft-delete:");
  const deleteOk = await fetch(base + `/products/${testProductId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  check("returns 200", deleteOk.status === 200);
  const productsAfterDelete = await get("/products");
  check("the discontinued product no longer appears in the public list", !productsAfterDelete.body.products.some((p) => p.id === testProductId));

  console.log("\nStock decrements on real payment, not on order creation:");
  const stockTestProduct = await post("/products", { name: "Stock Test Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 10 }, token);
  const stockProductId = stockTestProduct.body.product.id;
  const stockOrder = await post("/orders", { items: [{ id: stockProductId, qty: 3, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const stockAfterCreate = await get("/products");
  const foundAfterCreate = stockAfterCreate.body.products.find((p) => p.id === stockProductId);
  check("stock is NOT touched just by creating an order -- only a genuine payment should reduce it", foundAfterCreate && foundAfterCreate.stock === 10);

  const stockReference = `MA-${stockOrder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 3 * 1000 / 100 * 130 * 100 });
  const stockVerify = await post(`/orders/${stockOrder.body.order.id}/verify-payment`, { reference: stockReference }, customerToken);
  check("payment verifies successfully", stockVerify.status === 200);
  const stockAfterPay = await get("/products");
  const foundAfterPay = stockAfterPay.body.products.find((p) => p.id === stockProductId);
  check("stock genuinely decremented by the real quantity ordered once payment is confirmed", foundAfterPay && foundAfterPay.stock === 7);

  console.log("\nStock never goes negative, even if more is ordered and paid than remains:");
  const overorderProduct = await post("/products", { name: "Nearly Sold Out Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 2 }, token);
  const overorderId = overorderProduct.body.product.id;
  const overorder = await post("/orders", { items: [{ id: overorderId, qty: 2, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const overorderReference = `MA-${overorder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 2 * 1000 / 100 * 130 * 100 });
  await post(`/orders/${overorder.body.order.id}/verify-payment`, { reference: overorderReference }, customerToken);
  const secondOverorder = await post("/orders", { items: [{ id: overorderId, qty: 5, unitPriceCents: 1000 }], shippingName: "Test", shippingAddress: "1 Main St", shippingCity: "Nairobi" }, customerToken);
  const secondOverorderReference = `MA-${secondOverorder.body.order.orderNumber.replace("MA-", "")}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 5 * 1000 / 100 * 130 * 100 });
  await post(`/orders/${secondOverorder.body.order.id}/verify-payment`, { reference: secondOverorderReference }, customerToken);
  const stockAfterOverorder = await get("/products");
  const foundAfterOverorder = stockAfterOverorder.body.products.find((p) => p.id === overorderId);
  check("stock is clamped at zero, never negative, even when paid orders exceed what was available", foundAfterOverorder && foundAfterOverorder.stock === 0);

  console.log("\nGET /green-beans — public, no auth needed:");
  const greenNoAuth = await get("/green-beans");
  check("returns 200 without any token", greenNoAuth.status === 200);
  check("returns an array", Array.isArray(greenNoAuth.body.greenBeans));

  console.log("\nPOST /green-beans without a token:");
  const greenCreateNoAuth = await post("/green-beans", { name: "Test Lot", country: "Testland", pricePerKgCents: 1000, stockKg: 50, minOrderKg: 5 });
  check("returns 401", greenCreateNoAuth.status === 401);

  console.log("\nPOST /green-beans as a non-admin:");
  const greenCreateAsCustomer = await post("/green-beans", { name: "Test Lot", country: "Testland", pricePerKgCents: 1000, stockKg: 50, minOrderKg: 5 }, customerToken);
  check("returns 403", greenCreateAsCustomer.status === 403);

  console.log("\nPOST /green-beans with a non-positive price:");
  const greenCreateBadPrice = await post("/green-beans", { name: "Test Lot", country: "Testland", pricePerKgCents: 0, stockKg: 50, minOrderKg: 5 }, token);
  check("returns 400", greenCreateBadPrice.status === 400);

  console.log("\nPOST /green-beans where minimum order exceeds stock:");
  const greenCreateBadMinOrder = await post("/green-beans", { name: "Test Lot", country: "Testland", pricePerKgCents: 1000, stockKg: 10, minOrderKg: 50 }, token);
  check("returns 400 -- can't require a bigger minimum order than what's in stock", greenCreateBadMinOrder.status === 400);

  console.log("\nPOST /green-beans — a real, valid lot:");
  const greenCreateOk = await post("/green-beans", {
    name: "Test Lot", country: "Testland", pricePerKgCents: 1000, stockKg: 50, minOrderKg: 5,
    cuppingScore: 85, moisture: "11.0%", grade: "AA", process: "Washed", notes: "A test lot",
  }, token);
  check("returns 201", greenCreateOk.status === 201);
  check("id is generated as green-<slug>, matching the frontend's own id format exactly", greenCreateOk.body.greenBean && greenCreateOk.body.greenBean.id === "green-test-lot-testland");
  check("no roastedId by default -- a new admin-added lot has no retail counterpart", greenCreateOk.body.greenBean && greenCreateOk.body.greenBean.roastedId == null);
  const testGreenBeanId = greenCreateOk.body.greenBean.id;

  console.log("\nPOST /green-beans with the same name + country again:");
  const greenCreateDup = await post("/green-beans", { name: "Test Lot", country: "Testland", pricePerKgCents: 1000, stockKg: 50, minOrderKg: 5 }, token);
  check("returns 409", greenCreateDup.status === 409);

  console.log("\nGET /green-beans now includes the new lot:");
  const greenAfterCreate = await get("/green-beans");
  check("the new lot appears in the public list", greenAfterCreate.body.greenBeans.some((g) => g.id === testGreenBeanId));

  console.log("\nPATCH /green-beans/:id — a real, partial price-only update:");
  const greenPatchPrice = await patch(`/green-beans/${testGreenBeanId}`, { pricePerKgCents: 1200 }, token);
  check("returns 200", greenPatchPrice.status === 200);
  check("price actually changed", greenPatchPrice.body.greenBean && greenPatchPrice.body.greenBean.pricePerKgCents === 1200);
  check("stock wasn't sent, and is still correct", greenPatchPrice.body.greenBean && greenPatchPrice.body.greenBean.stockKg === 50);

  console.log("\nPATCH /green-beans/:id -- stock-only update still checked against the real, current minOrderKg:");
  const greenPatchTooLowStock = await patch(`/green-beans/${testGreenBeanId}`, { stockKg: 2 }, token);
  check("returns 400 -- this lot's real minOrderKg (5) would now exceed the new stock (2), checked against current state not just the request body", greenPatchTooLowStock.status === 400);

  console.log("\nDELETE /green-beans/:id as a non-admin:");
  const greenDeleteAsCustomer = await fetch(base + `/green-beans/${testGreenBeanId}`, { method: "DELETE", headers: { Authorization: `Bearer ${customerToken}` } });
  check("returns 403", greenDeleteAsCustomer.status === 403);

  console.log("\nDELETE /green-beans/:id — real soft-delete:");
  const greenDeleteOk = await fetch(base + `/green-beans/${testGreenBeanId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  check("returns 200", greenDeleteOk.status === 200);
  const greenAfterDelete = await get("/green-beans");
  check("the discontinued lot no longer appears in the public list", !greenAfterDelete.body.greenBeans.some((g) => g.id === testGreenBeanId));

  console.log("\nDuplicate registration:");
  const dup = await post("/auth/register", { email: "test@morningaroma.local", password: "differentpassword", name: "Someone Else" });
  check("returns 409", dup.status === 409);

  console.log("\nWeak password rejected:");
  const weak = await post("/auth/register", { email: "weak@morningaroma.local", password: "short", name: "Weak" });
  check("returns 400", weak.status === 400);

  console.log("\nInvalid email rejected:");
  const badEmail = await post("/auth/register", { email: "not-an-email", password: "correcthorsebattery", name: "Bad" });
  check("returns 400", badEmail.status === 400);

  console.log("\nLogin with correct credentials:");
  const login = await post("/auth/login", { email: "test@morningaroma.local", password: "correcthorsebattery" });
  check("returns 200", login.status === 200);
  check("returns a token", typeof login.body.token === "string");

  console.log("\nLogin with wrong password:");
  const wrongPw = await post("/auth/login", { email: "test@morningaroma.local", password: "wrongpassword" });
  check("returns 401", wrongPw.status === 401);

  console.log("\nLogin with non-existent email:");
  const noSuchUser = await post("/auth/login", { email: "nobody@morningaroma.local", password: "whatever123" });
  check("returns 401", noSuchUser.status === 401);
  check("same generic message as wrong-password case (no user enumeration)", noSuchUser.body.error === wrongPw.body.error);

  console.log("\nGET /me with valid token:");
  const me = await get("/auth/me", token);
  check("returns 200", me.status === 200);
  check("returns the right user", me.body.user && me.body.user.email === "test@morningaroma.local");

  console.log("\nGET /me with no token:");
  const meNoToken = await get("/auth/me");
  check("returns 401", meNoToken.status === 401);

  console.log("\nGET /me with garbage token:");
  const meBadToken = await get("/auth/me", "not-a-real-token");
  check("returns 401", meBadToken.status === 401);

  console.log("\nPassword reset request, existing email:");
  const resetReq = await post("/auth/password-reset/request", { email: "test@morningaroma.local" });
  check("returns 200", resetReq.status === 200);

  console.log("\nPassword reset request, non-existent email:");
  const resetReqFake = await post("/auth/password-reset/request", { email: "nobody@morningaroma.local" });
  check("returns 200 (not a 404 — would leak account existence)", resetReqFake.status === 200);
  check("identical message to the real-account case (no user enumeration)", resetReqFake.body.message === resetReq.body.message);

  console.log("\nPassword reset confirm with bogus token:");
  const badConfirm = await post("/auth/password-reset/confirm", { token: "not-a-real-token", newPassword: "newpassword123" });
  check("returns 400", badConfirm.status === 400);

  console.log("\nFull password reset round-trip (capturing the dev-mode logged token):");
  let capturedLog = "";
  const originalLog = console.log;
  console.log = (...args) => { capturedLog += args.join(" ") + "\n"; originalLog(...args); };
  await post("/auth/password-reset/request", { email: "test@morningaroma.local" });
  console.log = originalLog;
  const match = capturedLog.match(/reset-password\?token=([a-f0-9]+)/);
  check("dev-mode log actually contains a real reset token", !!match);
  const resetToken = match ? match[1] : null;

  const confirmed = await post("/auth/password-reset/confirm", { token: resetToken, newPassword: "brandnewpassword123" });
  check("confirm returns 200", confirmed.status === 200);

  const oldPwLogin = await post("/auth/login", { email: "test@morningaroma.local", password: "correcthorsebattery" });
  check("old password no longer works after reset", oldPwLogin.status === 401);

  const newPwLogin = await post("/auth/login", { email: "test@morningaroma.local", password: "brandnewpassword123" });
  check("new password works after reset", newPwLogin.status === 200);

  const reuseToken = await post("/auth/password-reset/confirm", { token: resetToken, newPassword: "anotherpassword123" });
  check("reset token can't be reused after it's already been consumed", reuseToken.status === 400);

  console.log("\nEmail sending, with a real provider configured (mocked network call):");
  process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";
  resendMock.resetSentEmails();

  const regForEmail = await post("/auth/register", { email: "emailtest@morningaroma.local", password: "correcthorsebattery", name: "Email Test" });
  check("registration still succeeds with a real provider configured", regForEmail.status === 201);
  const sentAfterRegister = resendMock.getSentEmails();
  check("a welcome email genuinely went through resend.emails.send(), not just the dev-mode log", sentAfterRegister.length === 1);
  check("sent to the right address", sentAfterRegister[0] && sentAfterRegister[0].to === "emailtest@morningaroma.local");
  check("real subject line, not a placeholder", sentAfterRegister[0] && sentAfterRegister[0].subject === "Welcome to Morning Aroma — where quality meets its scent.");
  check("does not link to a domain the project owner doesn't own", sentAfterRegister[0] && !sentAfterRegister[0].text.includes("morningaroma.com"));

  resendMock.resetSentEmails();
  await post("/auth/password-reset/request", { email: "emailtest@morningaroma.local" });
  const sentAfterReset = resendMock.getSentEmails();
  check("a real password reset email was sent through the provider", sentAfterReset.length === 1 && sentAfterReset[0].to === "emailtest@morningaroma.local");
  check("reset email links to the real deployed site, not a placeholder", sentAfterReset[0] && sentAfterReset[0].text.includes("reset-password?token="));

  console.log("\nRegistration still succeeds even if the email provider itself fails:");
  resendMock.setNextError("Simulated Resend outage");
  const regDuringOutage = await post("/auth/register", { email: "duringoutage@morningaroma.local", password: "correcthorsebattery", name: "Outage Test" });
  check("registration is fire-and-forget with respect to email -- a provider failure must never block or fail the actual signup", regDuringOutage.status === 201);
  resendMock.clearError();
  delete process.env.RESEND_API_KEY;

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Test script crashed:", e); process.exit(1); });
