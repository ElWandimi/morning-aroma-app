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

const app = require("../src/app");

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
  check("returns 400 -- can't cancel an order that isn't yours", cancelWrongOwner.status === 400);

  console.log("\nPOST /orders/:id/cancel on your own order while still Processing:");
  const cancelOk = await post(`/orders/${secondOrder.body.order.id}/cancel`, {}, token);
  check("returns 200", cancelOk.status === 200);
  check("status is now Cancelled", cancelOk.body.order && cancelOk.body.order.status === "Cancelled");

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

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Test script crashed:", e); process.exit(1); });
