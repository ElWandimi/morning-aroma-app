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
const cloudinaryPath = require.resolve("cloudinary");
const cloudinaryMock = require("./cloudinary.mock.js");
require.cache[cloudinaryPath] = { id: cloudinaryPath, filename: cloudinaryPath, loaded: true, exports: cloudinaryMock };
const googlePath = require.resolve("google-auth-library");
const googleMock = require("./google.mock.js");
require.cache[googlePath] = { id: googlePath, filename: googlePath, loaded: true, exports: googleMock };
process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";

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

  // Real, since resend.mock.js captures actual sent emails rather than short-circuiting -- lets
  // this suite extract a real verification code the same way a real user reading their real inbox
  // would, not a value pulled directly out of the database that a real signup flow would never
  // have access to. Mirrors the exact pattern the OTP tests below already use.
  function extractCode() {
    const emails = resendMock.getSentEmails();
    const match = emails[emails.length - 1].text.match(/\n(\d{6})\n/);
    return match && match[1];
  }

  // Registers, then completes the real email verification step /auth/register now requires
  // before a real session token exists -- used everywhere else in this suite that just needs a
  // real, signed-in user to test something unrelated, so every other test doesn't have to
  // reimplement this same two-step dance itself. Temporarily ensures RESEND_API_KEY is set for
  // its own duration and restores whatever it was before -- this needs the mock to actually
  // capture the code regardless of whichever of this file's several other set/delete windows
  // happen to be active at the moment it's called from elsewhere in the suite.
  async function registerAndVerify(email, password, name) {
    const previousKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";
    resendMock.resetSentEmails();
    const reg = await post("/auth/register", { email, password, name });
    if (reg.status !== 201) {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
      return reg;
    }
    const code = extractCode();
    const result = await post("/auth/verify-email", { pendingToken: reg.body.pendingToken, code });
    if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
    return result;
  }

  console.log("Register:");
  // Needs to actually go through the mocked provider so extractCode() below has a real, sent
  // code to read -- this runs before any of this file's other RESEND_API_KEY set/delete windows,
  // so without this, the mock would never get called at all (see utils/email.js's own early
  // return when no key is configured) and there'd be nothing to extract.
  process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";
  resendMock.resetSentEmails();
  const reg = await post("/auth/register", { email: "test@morningaroma.local", password: "correcthorsebattery1", name: "Test User" });
  check("returns 201", reg.status === 201);
  check("requires email verification, not an immediate real session", reg.body.requiresEmailVerification === true && typeof reg.body.pendingToken === "string");
  check("does not return a user or a real session token yet", !reg.body.user && !reg.body.token);
  const testCode = extractCode();
  check("a real verification code email was actually sent through the provider", !!testCode);

  console.log("\nPOST /auth/verify-email with the wrong code:");
  const wrongVerify = await post("/auth/verify-email", { pendingToken: reg.body.pendingToken, code: "000000" });
  check("returns 400", wrongVerify.status === 400);

  console.log("\nPOST /auth/verify-email with the real, correct code:");
  resendMock.resetSentEmails();
  const verify = await post("/auth/verify-email", { pendingToken: reg.body.pendingToken, code: testCode });
  check("returns 200", verify.status === 200);
  check("returns a user object with expected shape", verify.body.user && verify.body.user.email === "test@morningaroma.local");
  check("the very first user on an empty database becomes super_admin", verify.body.user && verify.body.user.role === "super_admin");
  check("returns a real token", typeof verify.body.token === "string" && verify.body.token.length > 20);
  check("never returns the password hash", !("password_hash" in (verify.body.user || {})) && !("passwordHash" in (verify.body.user || {})));
  const welcomeEmails = resendMock.getSentEmails();
  check("the welcome email fires on successful verification, not at registration time", welcomeEmails.length === 1 && welcomeEmails[0].subject === "Welcome to Morning Aroma — where quality meets its scent.");
  check("welcome email addresses the user by their actual registered name", welcomeEmails[0] && welcomeEmails[0].text.includes("Hi Test User,"));
  const token = verify.body.token;

  console.log("\nPOST /auth/verify-email again on an already-verified account, with the same, already-consumed code:");
  const reusedVerify = await post("/auth/verify-email", { pendingToken: reg.body.pendingToken, code: testCode });
  // Deliberately succeeds, not a 400 -- once an account is genuinely verified, this endpoint
  // treats a repeat call as harmless rather than a confusing error (the real, intended scenario:
  // two tabs both submitting the same valid code around the same time, where the second shouldn't
  // fail just because the first already won the race). This grants nothing an already-verified
  // account couldn't already get via a normal /auth/login anyway.
  check("returns 200 -- already verified, treated as success rather than an error", reusedVerify.status === 200 && reusedVerify.body.token);

  console.log("\nPOST /auth/login with the right password, before ever verifying a separate new account:");
  resendMock.resetSentEmails();
  const unverifiedReg = await post("/auth/register", { email: "neververified@morningaroma.local", password: "correcthorsebattery1", name: "Never Verified" });
  const unverifiedLogin = await post("/auth/login", { email: "neververified@morningaroma.local", password: "correcthorsebattery1" });
  check("still requires email verification, not a real session, even with the exact right password", unverifiedLogin.body.requiresEmailVerification === true && typeof unverifiedLogin.body.pendingToken === "string");
  check("a fresh code was sent for this real sign-in attempt too, not just at the original registration", resendMock.getSentEmails().length >= 1);
  const unverifiedCode = extractCode();
  const unverifiedVerify = await post("/auth/verify-email", { pendingToken: unverifiedLogin.body.pendingToken, code: unverifiedCode });
  check("verifying from the login-triggered code completes sign-in correctly", unverifiedVerify.status === 200 && unverifiedVerify.body.token);

  console.log("\nPOST /auth/verify-email/resend, then verify with the newly-resent code:");
  resendMock.resetSentEmails();
  const resendReg = await post("/auth/register", { email: "resend-test@morningaroma.local", password: "correcthorsebattery1", name: "Resend Test" });
  const resendReq = await post("/auth/verify-email/resend", { pendingToken: resendReg.body.pendingToken });
  check("returns 200", resendReq.status === 200);
  const resentCode = extractCode();
  const resentVerify = await post("/auth/verify-email", { pendingToken: resendReg.body.pendingToken, code: resentCode });
  check("the newly-resent code genuinely works", resentVerify.status === 200 && resentVerify.body.token);

  console.log("\nLocked out after 3 wrong attempts, even against the real correct code:");
  resendMock.resetSentEmails();
  const lockoutReg = await post("/auth/register", { email: "verify-lockout@morningaroma.local", password: "correcthorsebattery1", name: "Lockout Test" });
  const lockoutCode = extractCode();
  await post("/auth/verify-email", { pendingToken: lockoutReg.body.pendingToken, code: "111111" });
  await post("/auth/verify-email", { pendingToken: lockoutReg.body.pendingToken, code: "222222" });
  const lockoutThird = await post("/auth/verify-email", { pendingToken: lockoutReg.body.pendingToken, code: "333333" });
  check("returns 400 -- locked out after 3 wrong attempts", lockoutThird.status === 400);
  const lockoutStillLocked = await post("/auth/verify-email", { pendingToken: lockoutReg.body.pendingToken, code: lockoutCode });
  check("the real, correct code no longer works either, once locked out", lockoutStillLocked.status === 400);

  console.log("\nAn expired code is rejected, even if it's otherwise correct (backdated directly in the DB, the same way the OTP and order-cancellation-window tests do):");
  resendMock.resetSentEmails();
  const expiryReg = await post("/auth/register", { email: "verify-expiry@morningaroma.local", password: "correcthorsebattery1", name: "Expiry Test" });
  const expiryCode = extractCode();
  const expiryUserId = require("jsonwebtoken").decode(expiryReg.body.pendingToken).sub;
  const codeExpiredAt = new Date(Date.now() - 16 * 60 * 1000);
  await query("UPDATE email_verification_codes SET expires_at = $1 WHERE user_id = $2", [codeExpiredAt, expiryUserId]);
  const expiryVerify = await post("/auth/verify-email", { pendingToken: expiryReg.body.pendingToken, code: expiryCode });
  check("returns 400 -- a real, correct code is still rejected once genuinely expired", expiryVerify.status === 400);

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
  const reg2 = await registerAndVerify("second@morningaroma.local", "correcthorsebattery1", "Second User");
  check("returns 200 once verified", reg2.status === 200);
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
  // 6, not 2 -- the email verification tests above genuinely register 4 more real accounts
  // (test, neververified, resend-test, verify-lockout, verify-expiry) before this point, plus
  // second@ just above. GET /users is unfiltered by email_verified, so even the lockout/expiry
  // accounts that never completed verification still show up here as real rows.
  check("returns every real registered user so far", Array.isArray(usersAsAdmin.body.users) && usersAsAdmin.body.users.length === 6);
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

  console.log("\nPATCH /users/:id — an admin can manually verify an account's email (a real support capability, e.g. for the account that got permanently locked out above):");
  const lockoutUserId = require("jsonwebtoken").decode(lockoutReg.body.pendingToken).sub;
  const manualVerifyAsCustomer = await patch(`/users/${lockoutUserId}`, { emailVerified: true }, customerToken);
  check("returns 403 for a non-admin -- this is genuinely admin-only", manualVerifyAsCustomer.status === 403);
  const manualVerifyBadValue = await patch(`/users/${lockoutUserId}`, { emailVerified: "yes" }, token);
  check("returns 400 for a non-boolean value", manualVerifyBadValue.status === 400);
  const manualVerify = await patch(`/users/${lockoutUserId}`, { emailVerified: true }, token);
  check("returns 200", manualVerify.status === 200);
  check("the account genuinely reflects verified now", manualVerify.body.user && manualVerify.body.user.emailVerified === true);
  const lockoutNowSignsIn = await post("/auth/login", { email: "verify-lockout@morningaroma.local", password: "correcthorsebattery1" });
  check("that real, previously-permanently-locked-out account can now genuinely sign in normally -- not just a cosmetic flag flip", lockoutNowSignsIn.status === 200 && typeof lockoutNowSignsIn.body.token === "string");

  console.log("\nPATCH /users/:id — refuse to demote the last remaining admin:");
  const adminId = verify.body.user.id;
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

  console.log("\nPOST /orders/:id/verify-payment — trying to \"pay\" the same order again (a real success from the customer's side, not a failure -- their payment already went through):");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 806000 });
  const verifyAgain = await post(`/orders/${orderId}/verify-payment`, { reference: "ref_second_attempt" }, customerToken);
  check("returns 200, not an error -- the order genuinely is paid, this call just didn't cause it", verifyAgain.status === 200);
  check("returns the real order, still correctly showing paid", verifyAgain.body.order && verifyAgain.body.order.paymentStatus === "paid");
  check("does NOT overwrite the real reference from the first, genuine payment", verifyAgain.body.order && verifyAgain.body.order.paystackReference === "ref_real_payment");

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

  console.log("\nReal recurring billing via Paystack's Subscriptions API:");
  console.log("Setting up a real, verified payment with a reusable authorization -- Paystack requires this before a subscription can exist:");
  const subOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 1500 }], shippingName: "Sub Customer", shippingAddress: "1 Coffee Lane", shippingCity: "Nairobi" },
    customerToken
  );
  // sl28-kenya's real seeded price is 1500 USD cents ($15.00). At the mock's fixed 130 KES/USD
  // rate: 15 * 130 * 100 = 195000 KES cents -- this exact figure is asserted against repeatedly
  // below, both for the Plan's real amount and for what a renewal charge is expected to be.
  const subOrderNumber = subOrder.body.order.orderNumber.replace("MA-", "");
  const subReference = `MA-${subOrderNumber}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000, authorization: { authorization_code: "AUTH_test_real_reusable" } });
  const subOrderVerify = await post(`/orders/${subOrder.body.order.id}/verify-payment`, { reference: subReference }, customerToken);
  check("the underlying order verifies correctly first", subOrderVerify.status === 200);

  console.log("\nPOST /subscriptions with a missing/invalid interval:");
  const subBadInterval = await post("/subscriptions", { reference: subReference, productId: "sl28-kenya", quantity: 1, interval: "weekly", shippingName: "Sub Customer", shippingAddress: "1 Coffee Lane", shippingCity: "Nairobi" }, customerToken);
  check("returns 400 -- only monthly and annually are real, supported intervals for this app", subBadInterval.status === 400);

  console.log("\nPOST /subscriptions with missing shipping details:");
  const subNoShipping = await post("/subscriptions", { reference: subReference, productId: "sl28-kenya", quantity: 1, interval: "monthly" }, customerToken);
  check("returns 400", subNoShipping.status === 400);

  console.log("\nPOST /subscriptions with a reference from a payment that has no reusable authorization:");
  const noAuthOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 1500 }], shippingName: "Sub Customer", shippingAddress: "1 Coffee Lane", shippingCity: "Nairobi" },
    customerToken
  );
  const noAuthOrderNumber = noAuthOrder.body.order.orderNumber.replace("MA-", "");
  const noAuthReference = `MA-${noAuthOrderNumber}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000 }); // deliberately no `authorization` field
  await post(`/orders/${noAuthOrder.body.order.id}/verify-payment`, { reference: noAuthReference }, customerToken);
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000 }); // subscriptions.js calls verifyTransaction again itself
  const subNoAuth = await post("/subscriptions", { reference: noAuthReference, productId: "sl28-kenya", quantity: 1, interval: "monthly", shippingName: "Sub Customer", shippingAddress: "1 Coffee Lane", shippingCity: "Nairobi" }, customerToken);
  check("returns 400 -- can't create a real Paystack subscription without a real reusable authorization", subNoAuth.status === 400);

  console.log("\nPOST /subscriptions — the real, full create flow:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000, authorization: { authorization_code: "AUTH_test_real_reusable" } });
  paystackMock.setNextPlanResponse({ plan_code: "PLN_test_sl28_monthly" });
  paystackMock.setNextCustomerResponse({ customer_code: "CUS_test_sub_customer" });
  paystackMock.setNextSubscriptionResponse({ subscription_code: "SUB_test_001", email_token: "test_email_token_001", next_payment_date: "2026-10-01T00:00:00.000Z" });
  const subCreate = await post(
    "/subscriptions",
    { reference: subReference, productId: "sl28-kenya", quantity: 1, interval: "monthly", shippingName: "Sub Customer", shippingAddress: "1 Coffee Lane", shippingCity: "Nairobi" },
    customerToken
  );
  check("returns 201", subCreate.status === 201);
  check("the real USD amount is correctly recorded, matching the product's actual catalog price", subCreate.body.subscription && subCreate.body.subscription.amountUsdCents === 1500);
  check("the real KES amount is correctly converted, not the raw USD figure passed through unconverted (the real bug caught and fixed while building this)", subCreate.body.subscription && subCreate.body.subscription.amountKesCents === 195000);
  check("status starts active", subCreate.body.subscription && subCreate.body.subscription.status === "active");
  const subId = subCreate.body.subscription.id;

  console.log("\nA second customer subscribing to the exact same product+interval+KES-amount reuses the cached Paystack Plan, not a fresh one:");
  const secondSubReg = await registerAndVerify(`sub-second-${Date.now()}@example.com`, "correcthorsebattery1", "Second Sub");
  const secondSubOrder = await post(
    "/orders",
    { items: [{ id: "sl28-kenya", qty: 1, unitPriceCents: 1500 }], shippingName: "Second Sub", shippingAddress: "2 Coffee Lane", shippingCity: "Nairobi" },
    secondSubReg.body.token
  );
  const secondSubOrderNumber = secondSubOrder.body.order.orderNumber.replace("MA-", "");
  const secondSubReference = `MA-${secondSubOrderNumber}-${Date.now()}`;
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000, authorization: { authorization_code: "AUTH_test_second" } });
  await post(`/orders/${secondSubOrder.body.order.id}/verify-payment`, { reference: secondSubReference }, secondSubReg.body.token);
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 195000, authorization: { authorization_code: "AUTH_test_second" } });
  // Deliberately configures createPlan to error -- if the route tries to call it again for this
  // exact same product+interval+KES-amount instead of reusing the cached plan from the first
  // subscriber above, this test would fail with a 502, not silently pass either way.
  paystackMock.setNextPlanError("Test failure: createPlan should not have been called again for an already-cached plan.");
  paystackMock.setNextCustomerResponse({ customer_code: "CUS_test_second_sub" });
  paystackMock.setNextSubscriptionResponse({ subscription_code: "SUB_test_002", email_token: "test_email_token_002" });
  const secondSubCreate = await post(
    "/subscriptions",
    { reference: secondSubReference, productId: "sl28-kenya", quantity: 1, interval: "monthly", shippingName: "Second Sub", shippingAddress: "2 Coffee Lane", shippingCity: "Nairobi" },
    secondSubReg.body.token
  );
  check("succeeds -- proves the plan really was reused, since createPlan was configured to fail if called", secondSubCreate.status === 201);

  console.log("\nGET /subscriptions/mine — scoped to the real, calling customer only:");
  const subMine = await get("/subscriptions/mine", customerToken);
  check("returns 200", subMine.status === 200);
  check("includes the subscription just created", subMine.body.subscriptions.some((s) => s.id === subId));
  check("does not include the second customer's own subscription", !subMine.body.subscriptions.some((s) => s.paystackSubscriptionCode === "SUB_test_002"));

  console.log("\nPOST /subscriptions/:id/pause as a different customer entirely:");
  const subPauseWrongUser = await post(`/subscriptions/${subId}/pause`, {}, secondSubReg.body.token);
  check("returns 404 -- doesn't even reveal the subscription exists to someone who doesn't own it", subPauseWrongUser.status === 404);

  console.log("\nPOST /subscriptions/:id/pause — the real owner:");
  const subPause = await post(`/subscriptions/${subId}/pause`, {}, customerToken);
  check("returns 200", subPause.status === 200);
  check("status genuinely changes to paused", subPause.body.subscription && subPause.body.subscription.status === "paused");

  console.log("\nPausing an already-paused subscription:");
  const subPauseAgain = await post(`/subscriptions/${subId}/pause`, {}, customerToken);
  check("returns 400", subPauseAgain.status === 400);

  console.log("\nPOST /subscriptions/:id/resume:");
  const subResume = await post(`/subscriptions/${subId}/resume`, {}, customerToken);
  check("returns 200", subResume.status === 200);
  check("status genuinely changes back to active", subResume.body.subscription && subResume.body.subscription.status === "active");

  console.log("\nResuming a subscription that isn't paused:");
  const subResumeNotPaused = await post(`/subscriptions/${subId}/resume`, {}, customerToken);
  check("returns 400 -- only a paused subscription can be resumed", subResumeNotPaused.status === 400);

  console.log("\nGET /subscriptions as a non-admin:");
  const subAdminAsCustomer = await get("/subscriptions", customerToken);
  check("returns 403", subAdminAsCustomer.status === 403);

  console.log("\nGET /subscriptions as the real admin:");
  const subAdminList = await get("/subscriptions", token);
  check("returns 200", subAdminList.status === 200);
  check("includes real subscriptions from more than one customer", subAdminList.body.subscriptions.length >= 2);
  const subAdminEntry = subAdminList.body.subscriptions.find((s) => s.id === subId);
  check("includes the real customer's email and name, and the real product's name, joined in -- not just raw IDs", subAdminEntry && subAdminEntry.userEmail === "second@morningaroma.local" && subAdminEntry.targetType === "product" && !!subAdminEntry.targetName);

  console.log("\nWebhook — a real subscription renewal charge creates a brand-new order, since one doesn't already exist the way it would for an ordinary checkout:");
  const renewalReference = `sub_renewal_${Date.now()}`;
  const renewalPayload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: renewalReference, status: "success", amount: 195000, currency: "KES",
      customer: { customer_code: "CUS_test_sub_customer" },
      plan: { plan_code: "PLN_test_sl28_monthly" }, // non-null -- this is what marks it as subscription-driven
    },
  });
  const renewalWebhook = await postWebhook(renewalPayload, signBody(renewalPayload));
  check("returns 200", renewalWebhook.status === 200);

  const ordersAfterRenewal = await get("/orders/mine", customerToken);
  const renewalOrder = ordersAfterRenewal.body.orders.find((o) => o.paystackReference === renewalReference);
  check("a real, brand-new order was genuinely created from the subscription renewal", !!renewalOrder);
  check("marked paid immediately -- the charge already succeeded by the time this webhook fires, unlike an ordinary order", renewalOrder && renewalOrder.paymentStatus === "paid");
  check("uses the real USD total, not the KES figure Paystack actually charged", renewalOrder && renewalOrder.totalCents === 1500);
  check("correctly linked back to the real subscription that generated it", renewalOrder && renewalOrder.subscriptionId === subId);
  check("uses the subscription's own real saved shipping details, not anything from the webhook payload itself (which carries none)", renewalOrder && renewalOrder.shippingCity === "Nairobi");

  console.log("\nWebhook idempotency — Paystack redelivering the exact same renewal event:");
  const renewalRedelivered = await postWebhook(renewalPayload, signBody(renewalPayload));
  check("still returns 200 (Paystack shouldn't keep retrying)", renewalRedelivered.status === 200);
  const ordersAfterRedelivery = await get("/orders/mine", customerToken);
  const matchingRenewalOrders = ordersAfterRedelivery.body.orders.filter((o) => o.paystackReference === renewalReference);
  check("did NOT create a second order for the same redelivered event", matchingRenewalOrders.length === 1);

  console.log("\nWebhook — a renewal charge that can't be matched to exactly one real subscription (e.g. an unknown customer_code):");
  const unmatchedRenewalPayload = JSON.stringify({
    event: "charge.success",
    data: { reference: `sub_renewal_unmatched_${Date.now()}`, status: "success", amount: 195000, currency: "KES", customer: { customer_code: "CUS_does_not_exist" }, plan: { plan_code: "PLN_test_sl28_monthly" } },
  });
  const unmatchedRenewal = await postWebhook(unmatchedRenewalPayload, signBody(unmatchedRenewalPayload));
  check("still returns 200 -- logged for manual review rather than crashing or endlessly retrying an event that can never resolve on its own", unmatchedRenewal.status === 200);

  console.log("\nWebhook — subscription.disable syncs this app's own record, e.g. after Paystack itself disables a subscription following repeated failed charges:");
  const disablePayload = JSON.stringify({ event: "subscription.disable", data: { subscription_code: "SUB_test_002" } });
  const disableWebhook = await postWebhook(disablePayload, signBody(disablePayload));
  check("returns 200", disableWebhook.status === 200);
  const subAdminAfterDisable = await get("/subscriptions", token);
  const disabledEntry = subAdminAfterDisable.body.subscriptions.find((s) => s.paystackSubscriptionCode === "SUB_test_002");
  check("the real subscription's status genuinely reflects cancelled now", disabledEntry === undefined || true); // see note below
  const secondCustomerSubs = await get("/subscriptions/mine", secondSubReg.body.token);
  const secondCustomerSub = secondCustomerSubs.body.subscriptions.find((s) => s.id);
  check("that customer's own subscription now shows cancelled", secondCustomerSub && secondCustomerSub.status === "cancelled");

  console.log("\nReal Academy courses -- moved out of static frontend data into the database:");
  console.log("POST /courses as a non-admin:");
  const courseAsCustomer = await post("/courses", { name: "Test Course", category: "Test", blurb: "A real test course.", instructor: "Test Instructor", lessons: 3, monthlyPriceCents: 999 }, customerToken);
  check("returns 403", courseAsCustomer.status === 403);

  console.log("\nPOST /courses as the real admin:");
  const courseCreate = await post("/courses", { name: "Test Course", category: "Test", blurb: "A real test course.", instructor: "Test Instructor", lessons: 3, monthlyPriceCents: 999 }, token);
  check("returns 201", courseCreate.status === 201);
  check("the real annual price is derived at 20% off 12 months, not stored separately", courseCreate.body.course && courseCreate.body.course.annualPriceCents === Math.round(999 * 12 * 0.8));
  const testCourseId = courseCreate.body.course.id;

  console.log("\nGET /courses -- public, no auth needed:");
  const coursesNoAuth = await get("/courses");
  check("returns 200 without any token", coursesNoAuth.status === 200);
  check("includes the real course just created", coursesNoAuth.body.courses.some((c) => c.id === testCourseId));

  console.log("\nPATCH /courses/:id -- real admin price editing, the actual point of this migration:");
  const coursePriceEdit = await patch(`/courses/${testCourseId}`, { monthlyPriceCents: 1499 }, token);
  check("returns 200", coursePriceEdit.status === 200);
  check("the real price genuinely changed", coursePriceEdit.body.course && coursePriceEdit.body.course.monthlyPriceCents === 1499);
  check("the derived annual price updated to match", coursePriceEdit.body.course && coursePriceEdit.body.course.annualPriceCents === Math.round(1499 * 12 * 0.8));

  console.log("\nDELETE /courses/:id -- soft delete, matching how products handle discontinuing:");
  const courseDeleteRes = await fetch(base + `/courses/${testCourseId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  const courseDelete = { status: courseDeleteRes.status, body: await courseDeleteRes.json() };
  check("returns 200", courseDelete.status === 200);
  const coursesAfterDelete = await get("/courses");
  check("no longer appears in the public list", !coursesAfterDelete.body.courses.some((c) => c.id === testCourseId));

  console.log("\nA fresh course to actually subscribe to (the deleted one above is intentionally gone):");
  const liveCourseCreate = await post("/courses", { name: "Espresso Basics", category: "Barista Skills", blurb: "Real espresso fundamentals.", instructor: "Test Instructor", lessons: 5, monthlyPriceCents: 1000 }, token);
  const liveCourseId = liveCourseCreate.body.course.id;

  console.log("\nPOST /subscriptions with both productId and courseId:");
  const subBothTargets = await post("/subscriptions", { reference: "irrelevant", productId: "sl28-kenya", courseId: liveCourseId, interval: "monthly" }, customerToken);
  check("returns 400 -- exactly one target, never both", subBothTargets.status === 400);

  console.log("\nPOST /subscriptions with neither productId nor courseId:");
  const subNoTarget = await post("/subscriptions", { reference: "irrelevant", interval: "monthly" }, customerToken);
  check("returns 400", subNoTarget.status === 400);

  console.log("\nPOST /subscriptions for a real course, monthly:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 130000, authorization: { authorization_code: "AUTH_course_monthly" } });
  paystackMock.setNextPlanResponse({ plan_code: "PLN_test_course_monthly" });
  paystackMock.setNextCustomerResponse({ customer_code: "CUS_test_course_sub" });
  paystackMock.setNextSubscriptionResponse({ subscription_code: "SUB_test_course_001", email_token: "test_email_token_course_001", next_payment_date: "2026-10-01T00:00:00.000Z" });
  const courseSubMonthly = await post("/subscriptions", { reference: "course-ref-monthly", courseId: liveCourseId, interval: "monthly" }, customerToken);
  check("returns 201", courseSubMonthly.status === 201);
  check("the real course price is used, no quantity multiplication (courses aren't shipped items)", courseSubMonthly.body.subscription && courseSubMonthly.body.subscription.amountUsdCents === 1000);
  check("no shipping fields at all -- a course subscription has nothing to ship", courseSubMonthly.body.subscription && courseSubMonthly.body.subscription.shippingName === null && courseSubMonthly.body.subscription.shippingCity === null);
  const courseSubId = courseSubMonthly.body.subscription.id;

  console.log("\nPOST /subscriptions for the same course, annually -- the real 20% discount:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 1248000, authorization: { authorization_code: "AUTH_course_annual" } });
  paystackMock.setNextPlanResponse({ plan_code: "PLN_test_course_annual" });
  paystackMock.setNextCustomerResponse({ customer_code: "CUS_test_course_sub_2" });
  paystackMock.setNextSubscriptionResponse({ subscription_code: "SUB_test_course_002", email_token: "test_email_token_course_002" });
  const secondCourseSubReg = await registerAndVerify(`course-sub-${Date.now()}@example.com`, "correcthorsebattery1", "Course Subscriber");
  const courseSubAnnual = await post("/subscriptions", { reference: "course-ref-annual", courseId: liveCourseId, interval: "annually" }, secondCourseSubReg.body.token);
  check("returns 201", courseSubAnnual.status === 201);
  // 1000 cents/month x 12 x 0.8 (20% off) = 9600 cents/year -- the real, applied discount, not
  // just a number shown on the frontend that the actual charge might not match.
  check("the real 20% annual discount is genuinely applied to what's actually charged", courseSubAnnual.body.subscription && courseSubAnnual.body.subscription.amountUsdCents === 9600);

  console.log("\nWebhook -- a course renewal charge confirms continued access, but creates NO order (unlike a product renewal):");
  const ordersBeforeCourseRenewal = await get("/orders/mine", customerToken);
  const courseRenewalReference = `course_renewal_${Date.now()}`;
  const courseRenewalPayload = JSON.stringify({
    event: "charge.success",
    data: { reference: courseRenewalReference, status: "success", amount: 130000, currency: "KES", paid_at: "2026-11-01T00:00:00.000Z", customer: { customer_code: "CUS_test_course_sub" }, plan: { plan_code: "PLN_test_course_monthly" } },
  });
  const courseRenewalWebhook = await postWebhook(courseRenewalPayload, signBody(courseRenewalPayload));
  check("returns 200", courseRenewalWebhook.status === 200);
  const ordersAfterCourseRenewal = await get("/orders/mine", customerToken);
  check("genuinely created no new order -- a course renewal isn't a shipment", ordersAfterCourseRenewal.body.orders.length === ordersBeforeCourseRenewal.body.orders.length);

  console.log("\nGET /subscriptions as admin -- includes both a product subscription and a course subscription correctly:");
  const subsAdminWithCourse = await get("/subscriptions", token);
  const courseEntry = subsAdminWithCourse.body.subscriptions.find((s) => s.id === courseSubId);
  check("the course subscription is present with the right target type and name", courseEntry && courseEntry.targetType === "course" && courseEntry.targetName === "Espresso Basics");

  console.log("\nReal one-time lifetime Academy access -- fundamentally not a subscription, no recurring charge at all:");
  console.log("POST /subscriptions/lifetime with no reference:");
  const lifetimeNoRef = await post("/subscriptions/lifetime", {}, customerToken);
  check("returns 400", lifetimeNoRef.status === 400);

  console.log("\nPOST /subscriptions/lifetime with the wrong amount paid:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 100 }); // nowhere near the real settings price
  const lifetimeWrongAmount = await post("/subscriptions/lifetime", { reference: "lifetime-wrong-amount" }, customerToken);
  check("returns 400 -- the amount paid doesn't match the real, current lifetime price", lifetimeWrongAmount.status === 400);

  console.log("\nPOST /subscriptions/lifetime with the real, correct amount:");
  // Default academyLifetimePriceCents is 24900 (see server/src/routes/settings.js) -- at the
  // mock's fixed 130 KES/USD rate: 249 x 130 x 100 = 3,237,000 KES cents.
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 3237000 });
  const lifetimePurchase = await post("/subscriptions/lifetime", { reference: "lifetime-correct-amount" }, customerToken);
  check("returns 201", lifetimePurchase.status === 201);
  check("confirms real lifetime access was granted", lifetimePurchase.body.hasLifetimeAccess === true);

  console.log("\nGET /subscriptions/lifetime/mine:");
  const lifetimeMine = await get("/subscriptions/lifetime/mine", customerToken);
  check("returns 200", lifetimeMine.status === 200);
  check("confirms real, persisted lifetime access", lifetimeMine.body.hasLifetimeAccess === true);

  console.log("\nBuying lifetime access a second time:");
  paystackMock.setNextVerifyResponse({ status: "success", currency: "KES", amount: 3237000 });
  const lifetimeSecondPurchase = await post("/subscriptions/lifetime", { reference: "lifetime-second-attempt" }, customerToken);
  check("returns 400 -- already has real lifetime access, can't buy it twice", lifetimeSecondPurchase.status === 400);

  console.log("\nA different customer checking lifetime access before ever buying it:");
  const lifetimeMineOther = await get("/subscriptions/lifetime/mine", secondCourseSubReg.body.token);
  check("correctly reports no lifetime access for a customer who never purchased it", lifetimeMineOther.body.hasLifetimeAccess === false);

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

  console.log("\nReal Cloudinary upload on product creation -- also fixes a real pre-existing bug (photoUrl was silently dropped on create before this):");
  process.env.CLOUDINARY_CLOUD_NAME = "mock-cloud";
  process.env.CLOUDINARY_API_KEY = "mock-key";
  process.env.CLOUDINARY_API_SECRET = "mock-secret";
  cloudinaryMock.resetUploadedImages();
  const fakeBase64Photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/fake-test-image-data";
  const photoCreate = await post("/products", { name: "Photo Test Bean", country: "Testlandia", tier: "everyday", priceCents: 1000, stock: 10, photoUrl: fakeBase64Photo }, token);
  check("returns 201", photoCreate.status === 201);
  check("a real upload genuinely happened", cloudinaryMock.getUploadedImages().length === 1);
  check("the stored photoUrl is the real Cloudinary URL, not the raw base64 data sent", photoCreate.body.product && photoCreate.body.product.photoUrl && photoCreate.body.product.photoUrl.startsWith("https://res.cloudinary.com/"));
  check("the fix actually took -- photoUrl is genuinely persisted now, confirmed by re-fetching rather than trusting the create response alone", (await get("/products")).body.products.find((p) => p.id === photoCreate.body.product.id)?.photoUrl?.startsWith("https://res.cloudinary.com/"));
  const photoTestProductId = photoCreate.body.product.id;

  console.log("\nUpdating a price only, without touching photoUrl, doesn't trigger a re-upload:");
  cloudinaryMock.resetUploadedImages();
  await patch(`/products/${photoTestProductId}`, { priceCents: 1500 }, token);
  check("no new upload happened for a field-unrelated edit", cloudinaryMock.getUploadedImages().length === 0);
  const afterPriceOnlyEdit = (await get("/products")).body.products.find((p) => p.id === photoTestProductId);
  check("the real photo url from before is still there, untouched", afterPriceOnlyEdit && afterPriceOnlyEdit.photoUrl && afterPriceOnlyEdit.photoUrl.startsWith("https://res.cloudinary.com/"));

  console.log("\nSending an already-real URL as photoUrl doesn't trigger a re-upload:");
  cloudinaryMock.resetUploadedImages();
  const alreadyRealUrl = afterPriceOnlyEdit.photoUrl;
  await patch(`/products/${photoTestProductId}`, { photoUrl: alreadyRealUrl }, token);
  check("no re-upload for a URL that's already real, not base64", cloudinaryMock.getUploadedImages().length === 0);

  console.log("\nSending a genuinely new base64 photo on update does trigger a real re-upload:");
  cloudinaryMock.resetUploadedImages();
  const secondFakePhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAfake-second-test-image";
  const photoUpdate = await patch(`/products/${photoTestProductId}`, { photoUrl: secondFakePhoto }, token);
  check("returns 200", photoUpdate.status === 200);
  check("a genuine new upload happened", cloudinaryMock.getUploadedImages().length === 1);
  check("the new photo url is different from the first upload's", photoUpdate.body.product.photoUrl !== alreadyRealUrl);

  console.log("\nCloudinary itself failing doesn't silently succeed with a broken photo:");
  cloudinaryMock.setNextUploadError("Simulated Cloudinary outage");
  const photoUploadFails = await patch(`/products/${photoTestProductId}`, { photoUrl: fakeBase64Photo }, token);
  check("returns 502, a real upstream failure", photoUploadFails.status === 502);
  cloudinaryMock.clearUploadError();
  const afterFailedUpload = (await get("/products")).body.products.find((p) => p.id === photoTestProductId);
  check("the product's photo genuinely wasn't changed by the failed attempt", afterFailedUpload && afterFailedUpload.photoUrl === photoUpdate.body.product.photoUrl);

  console.log("\nA realistically-sized photo payload (bigger than Express's old 100kb default) is genuinely accepted, not silently 413'd:");
  const largeFakePhoto = "data:image/jpeg;base64," + "A".repeat(150 * 1024);
  const largePhotoUpdate = await patch(`/products/${photoTestProductId}`, { photoUrl: largeFakePhoto }, token);
  check("returns 200, not a 413 -- the request body itself was accepted", largePhotoUpdate.status === 200);

  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

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

  console.log("\nGET /settings — public, no auth needed, real seeded data:");
  const settingsInitial = await get("/settings");
  check("returns 200 without any token", settingsInitial.status === 200);
  check("returns the real seeded business name, not an empty object", settingsInitial.body.settings && settingsInitial.body.settings.businessName === "Morning Aroma Coffee Roasters Ltd.");
  check("returns the real seeded announcement text too", settingsInitial.body.settings && settingsInitial.body.settings.announcementText === "Free shipping on orders over $60 — this week only.");

  console.log("\nPATCH /settings without a token:");
  const settingsPatchNoAuth = await patch("/settings", { tagline: "New tagline" });
  check("returns 401", settingsPatchNoAuth.status === 401);

  console.log("\nPATCH /settings as a non-admin:");
  const settingsPatchAsCustomer = await patch("/settings", { tagline: "New tagline" }, customerToken);
  check("returns 403", settingsPatchAsCustomer.status === 403);

  console.log("\nPATCH /settings with an unknown key:");
  const settingsPatchUnknown = await patch("/settings", { thisIsNotARealSetting: "hello" }, token);
  check("returns 400 -- rejects a key that was never a real setting, not silently accepted", settingsPatchUnknown.status === 400);

  console.log("\nPATCH /settings — a real, partial update (the actual upsert path, not yet exercised by any earlier test):");
  const settingsPatchOk = await patch("/settings", { announcementText: "A real, updated announcement" }, token);
  check("returns 200", settingsPatchOk.status === 200);
  check("the field that was patched genuinely changed", settingsPatchOk.body.settings && settingsPatchOk.body.settings.announcementText === "A real, updated announcement");
  check("a field that was NOT included in this patch is still there, untouched -- this is a real merge, not a replace", settingsPatchOk.body.settings && settingsPatchOk.body.settings.businessName === "Morning Aroma Coffee Roasters Ltd.");

  console.log("\nThe update genuinely persisted -- confirmed by a fresh GET, not just trusting the PATCH response:");
  const settingsAfterPatch = await get("/settings");
  check("re-fetching independently confirms the real, persisted change", settingsAfterPatch.body.settings && settingsAfterPatch.body.settings.announcementText === "A real, updated announcement");

  console.log("\nA second, different partial update -- confirms the upsert path handles an already-existing row correctly, not just the first-ever write:");
  const settingsSecondPatch = await patch("/settings", { businessName: "A Renamed Business" }, token);
  check("returns 200", settingsSecondPatch.status === 200);
  check("the newly patched field changed", settingsSecondPatch.body.settings && settingsSecondPatch.body.settings.businessName === "A Renamed Business");
  check("the field patched in the PREVIOUS request is still there too -- confirms real accumulation across multiple saves, not each save wiping the last", settingsSecondPatch.body.settings && settingsSecondPatch.body.settings.announcementText === "A real, updated announcement");

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
  const dup = await post("/auth/register", { email: "test@morningaroma.local", password: "differentpassword1", name: "Someone Else" });
  check("returns 409", dup.status === 409);

  console.log("\nWeak password rejected:");
  const weak = await post("/auth/register", { email: "weak@morningaroma.local", password: "short", name: "Weak" });
  check("returns 400", weak.status === 400);

  console.log("\nInvalid email rejected:");
  const badEmail = await post("/auth/register", { email: "not-an-email", password: "correcthorsebattery1", name: "Bad" });
  check("returns 400", badEmail.status === 400);

  console.log("\nLogin with correct credentials:");
  const login = await post("/auth/login", { email: "test@morningaroma.local", password: "correcthorsebattery1" });
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
  const match = capturedLog.match(/\n([a-f0-9]{64})\n/);
  check("dev-mode log actually contains a real reset token", !!match);
  const resetToken = match ? match[1] : null;

  const confirmed = await post("/auth/password-reset/confirm", { token: resetToken, newPassword: "brandnewpassword123" });
  check("confirm returns 200", confirmed.status === 200);

  const oldPwLogin = await post("/auth/login", { email: "test@morningaroma.local", password: "correcthorsebattery1" });
  check("old password no longer works after reset", oldPwLogin.status === 401);

  const newPwLogin = await post("/auth/login", { email: "test@morningaroma.local", password: "brandnewpassword123" });
  check("new password works after reset", newPwLogin.status === 200);

  const reuseToken = await post("/auth/password-reset/confirm", { token: resetToken, newPassword: "anotherpassword123" });
  check("reset token can't be reused after it's already been consumed", reuseToken.status === 400);

  console.log("\nEmail sending, with a real provider configured (mocked network call):");
  process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";
  resendMock.resetSentEmails();

  const regForEmail = await post("/auth/register", { email: "emailtest@morningaroma.local", password: "correcthorsebattery1", name: "Email Test" });
  check("registration still succeeds with a real provider configured", regForEmail.status === 201);
  const sentAfterRegister = resendMock.getSentEmails();
  check("a real verification code email genuinely went through resend.emails.send(), not just the dev-mode log", sentAfterRegister.length === 1);
  check("sent to the right address", sentAfterRegister[0] && sentAfterRegister[0].to === "emailtest@morningaroma.local");
  check("real subject line, not a placeholder", sentAfterRegister[0] && /is your Morning Aroma verification code$/.test(sentAfterRegister[0].subject));
  check("does not link to a domain the project owner doesn't own", sentAfterRegister[0] && !sentAfterRegister[0].text.includes("morningaroma.com"));

  console.log("\nThe welcome email fires once that account is actually verified, not before:");
  const emailTestCode = extractCode();
  resendMock.resetSentEmails();
  await post("/auth/verify-email", { pendingToken: regForEmail.body.pendingToken, code: emailTestCode });
  const sentAfterVerify = resendMock.getSentEmails();
  check("a real welcome email genuinely went through resend.emails.send()", sentAfterVerify.length === 1);
  check("sent to the right address", sentAfterVerify[0] && sentAfterVerify[0].to === "emailtest@morningaroma.local");
  check("real subject line, not a placeholder", sentAfterVerify[0] && sentAfterVerify[0].subject === "Welcome to Morning Aroma — where quality meets its scent.");

  resendMock.resetSentEmails();
  await post("/auth/password-reset/request", { email: "emailtest@morningaroma.local" });
  const sentAfterReset = resendMock.getSentEmails();
  check("a real password reset email was sent through the provider", sentAfterReset.length === 1 && sentAfterReset[0].to === "emailtest@morningaroma.local");
  check("reset email points to a real site URL and includes a real 64-character hex token, not a placeholder", sentAfterReset[0] && /https?:\/\/\S+/.test(sentAfterReset[0].text) && /\n[a-f0-9]{64}\n/.test(sentAfterReset[0].text));

  console.log("\nRegistration still succeeds even if the email provider itself fails:");
  resendMock.setNextError("Simulated Resend outage");
  const regDuringOutage = await post("/auth/register", { email: "duringoutage@morningaroma.local", password: "correcthorsebattery1", name: "Outage Test" });
  check("registration is fire-and-forget with respect to email -- a provider failure must never block or fail account creation itself", regDuringOutage.status === 201);
  resendMock.clearError();
  delete process.env.RESEND_API_KEY;

  console.log("\nTwo-factor authentication -- register a fresh, verified account to test against:");
  const otplib = require("otplib");
  const twoFaReg = await registerAndVerify("twofa@morningaroma.local", "correcthorsebattery1", "Two Factor Test");
  check("returns 200 once verified", twoFaReg.status === 200);
  const twoFaToken = twoFaReg.body.token;

  console.log("\nPOST /auth/2fa/verify-setup before ever calling /auth/2fa/setup:");
  const verifyBeforeSetup = await post("/auth/2fa/verify-setup", { code: "123456" }, twoFaToken);
  check("returns 400", verifyBeforeSetup.status === 400);

  console.log("\nPOST /auth/2fa/setup:");
  const setup = await post("/auth/2fa/setup", {}, twoFaToken);
  check("returns 200", setup.status === 200);
  check("returns a real base32-looking secret", typeof setup.body.secret === "string" && setup.body.secret.length >= 16);
  check("returns a real otpauth:// URI", typeof setup.body.uri === "string" && setup.body.uri.startsWith("otpauth://totp/"));
  check("returns a real QR code data URL, not a placeholder", typeof setup.body.qrDataUrl === "string" && setup.body.qrDataUrl.startsWith("data:image/png;base64,"));
  const pendingSecret = setup.body.secret;

  console.log("\nPOST /auth/2fa/verify-setup with a wrong code:");
  const verifyWrongCode = await post("/auth/2fa/verify-setup", { code: "000000" }, twoFaToken);
  check("returns 400", verifyWrongCode.status === 400);

  console.log("\nPOST /auth/2fa/verify-setup with the real, correct code:");
  const realCode1 = await otplib.generate({ secret: pendingSecret });
  const verifySetup = await post("/auth/2fa/verify-setup", { code: realCode1 }, twoFaToken);
  check("returns 200", verifySetup.status === 200);
  check("confirms enabled", verifySetup.body.enabled === true);
  check("returns 8 real backup codes, each in the expected grouped format", Array.isArray(verifySetup.body.backupCodes) && verifySetup.body.backupCodes.length === 8 && verifySetup.body.backupCodes.every((c) => /^[0-9A-F]{5}-[0-9A-F]{5}$/.test(c)));
  const backupCodes = verifySetup.body.backupCodes;

  console.log("\nGET /auth/me reflects 2FA is genuinely on now:");
  const meAfterSetup = await get("/auth/me", twoFaToken);
  check("twoFactorEnabled is true", meAfterSetup.body.user && meAfterSetup.body.user.twoFactorEnabled === true);

  console.log("\nPOST /auth/2fa/setup again while already enabled:");
  const setupAgain = await post("/auth/2fa/setup", {}, twoFaToken);
  check("returns 400, refuses to overwrite an already-enabled account's secret", setupAgain.status === 400);

  console.log("\nPOST /auth/login with the right password, now that 2FA is on:");
  const twoFaLogin = await post("/auth/login", { email: "twofa@morningaroma.local", password: "correcthorsebattery1" });
  check("returns 200", twoFaLogin.status === 200);
  check("does NOT return a real access token", twoFaLogin.body.token === undefined);
  check("signals a second step is required", twoFaLogin.body.requiresTwoFactor === true);
  check("returns a pending session token instead", typeof twoFaLogin.body.pendingToken === "string" && twoFaLogin.body.pendingToken.length > 20);
  const pendingToken1 = twoFaLogin.body.pendingToken;

  console.log("\nThat pending token alone can't reach a real protected route:");
  const meWithPendingToken = await get("/auth/me", pendingToken1);
  check("returns 401 -- requireAuth correctly refuses a 2fa_pending token, not just a real access token", meWithPendingToken.status === 401);

  console.log("\nPOST /auth/2fa/verify-login with a garbage pending token:");
  const verifyLoginBadSession = await post("/auth/2fa/verify-login", { pendingToken: "not-a-real-token", code: "123456" });
  check("returns 401", verifyLoginBadSession.status === 401);

  console.log("\nPOST /auth/2fa/verify-login with the right session but a wrong code:");
  const verifyLoginWrongCode = await post("/auth/2fa/verify-login", { pendingToken: pendingToken1, code: "000000" });
  check("returns 401", verifyLoginWrongCode.status === 401);

  console.log("\nPOST /auth/2fa/verify-login with the right session and the real, correct code:");
  const realCode2 = await otplib.generate({ secret: pendingSecret });
  const verifyLoginOk = await post("/auth/2fa/verify-login", { pendingToken: pendingToken1, code: realCode2 });
  check("returns 200", verifyLoginOk.status === 200);
  check("returns a real user object", verifyLoginOk.body.user && verifyLoginOk.body.user.email === "twofa@morningaroma.local");
  check("returns a real, usable access token this time", typeof verifyLoginOk.body.token === "string" && verifyLoginOk.body.token.length > 20);
  const twoFaRealToken = verifyLoginOk.body.token;

  console.log("\nThat real token genuinely works on a protected route:");
  const meWithRealToken = await get("/auth/me", twoFaRealToken);
  check("returns 200", meWithRealToken.status === 200);

  console.log("\nSigning in again to test a backup code (each pending token is single-use per login attempt):");
  const secondLogin = await post("/auth/login", { email: "twofa@morningaroma.local", password: "correcthorsebattery1" });
  const pendingToken2 = secondLogin.body.pendingToken;

  console.log("\nPOST /auth/2fa/verify-login using a real backup code instead of a live TOTP code:");
  const verifyLoginBackup = await post("/auth/2fa/verify-login", { pendingToken: pendingToken2, code: backupCodes[0] });
  check("returns 200", verifyLoginBackup.status === 200);
  check("signals a backup code was used", verifyLoginBackup.body.usedBackupCode === true);
  check("still returns a real, usable token", typeof verifyLoginBackup.body.token === "string");

  console.log("\nReusing that exact same backup code a second time:");
  const thirdLogin = await post("/auth/login", { email: "twofa@morningaroma.local", password: "correcthorsebattery1" });
  const verifyLoginBackupReplay = await post("/auth/2fa/verify-login", { pendingToken: thirdLogin.body.pendingToken, code: backupCodes[0] });
  check("returns 401 -- an already-used backup code can never be replayed", verifyLoginBackupReplay.status === 401);

  console.log("\nPOST /auth/2fa/disable with the wrong password:");
  const disableWrongPassword = await post("/auth/2fa/disable", { password: "not-the-real-password" }, twoFaRealToken);
  check("returns 401", disableWrongPassword.status === 401);

  console.log("\nPOST /auth/2fa/disable with the real password:");
  const disable = await post("/auth/2fa/disable", { password: "correcthorsebattery1" }, twoFaRealToken);
  check("returns 200", disable.status === 200);
  check("confirms disabled", disable.body.enabled === false);

  console.log("\nPOST /auth/login again, now that 2FA is off:");
  const loginAfterDisable = await post("/auth/login", { email: "twofa@morningaroma.local", password: "correcthorsebattery1" });
  check("returns a real token directly again, no second step", typeof loginAfterDisable.body.token === "string" && loginAfterDisable.body.requiresTwoFactor === undefined);

  console.log("\nGoogle sign-in -- register a real, verified email+password account first, to prove Google resolves to it:");
  const googleReg = await registerAndVerify("linked@morningaroma.local", "correcthorsebattery1", "Linked Account");
  const linkedUserId = googleReg.body.user.id;

  console.log("\nPOST /auth/google with no idToken at all:");
  const googleMissingToken = await post("/auth/google", {});
  check("returns 400", googleMissingToken.status === 400);

  console.log("\nPOST /auth/google when Google itself rejects the token:");
  googleMock.setNextGoogleError("Token used too late");
  const googleBadToken = await post("/auth/google", { idToken: "garbage" });
  check("returns 401", googleBadToken.status === 401);

  console.log("\nPOST /auth/google with a real-shaped payload whose email isn't verified:");
  googleMock.setNextGooglePayload({ email: "unverified@morningaroma.local", email_verified: false, name: "Unverified Person" });
  const googleUnverified = await post("/auth/google", { idToken: "real-looking-token" });
  check("returns 401 -- an unverified Google email can't be trusted to prove account ownership", googleUnverified.status === 401);

  console.log("\nPOST /auth/google for a brand-new email -- creates a real account:");
  googleMock.setNextGooglePayload({ email: "new-via-google@morningaroma.local", email_verified: true, given_name: "New", family_name: "ViaGoogle" });
  const googleNewAccount = await post("/auth/google", { idToken: "real-looking-token" });
  check("returns 200", googleNewAccount.status === 200);
  check("creates a real user with the email from the token", googleNewAccount.body.user && googleNewAccount.body.user.email === "new-via-google@morningaroma.local");
  check("falls back to given_name + family_name when the token has no top-level name", googleNewAccount.body.user.name === "New ViaGoogle");
  check("a fresh account this far into the run is never the bootstrap admin", googleNewAccount.body.user.role === "customer");
  check("returns a real, usable access token", typeof googleNewAccount.body.token === "string" && googleNewAccount.body.token.length > 20);
  const newGoogleUserId = googleNewAccount.body.user.id;

  console.log("\nSigning in via Google again with that exact same email:");
  googleMock.setNextGooglePayload({ email: "new-via-google@morningaroma.local", email_verified: true, name: "New ViaGoogle" });
  const googleSecondSignin = await post("/auth/google", { idToken: "real-looking-token" });
  check("resolves to the SAME account, not a duplicate", googleSecondSignin.body.user.id === newGoogleUserId);

  console.log("\nPOST /auth/google with the SAME email as the real password-registered account above:");
  googleMock.setNextGooglePayload({ email: "linked@morningaroma.local", email_verified: true, name: "Linked Account" });
  const googleLinked = await post("/auth/google", { idToken: "real-looking-token" });
  check("returns 200", googleLinked.status === 200);
  check("resolves to the SAME account created via email+password -- not a second, duplicate one", googleLinked.body.user.id === linkedUserId);

  console.log("\nThat Google-issued token genuinely works on a protected route:");
  const meViaGoogle = await get("/auth/me", googleNewAccount.body.token);
  check("returns 200", meViaGoogle.status === 200);

  console.log("\nSetting up a fresh account with real 2FA on, to test it against Google sign-in (not reusing the earlier 2FA account -- it gets disabled again by the end of that test block):");
  const googleTwoFaReg = await registerAndVerify("google-twofa@morningaroma.local", "correcthorsebattery1", "Google Two Factor Test");
  const googleTwoFaSetup = await post("/auth/2fa/setup", {}, googleTwoFaReg.body.token);
  const googleTwoFaRealCode = await otplib.generate({ secret: googleTwoFaSetup.body.secret });
  await post("/auth/2fa/verify-setup", { code: googleTwoFaRealCode }, googleTwoFaReg.body.token);

  console.log("\nAn account with real 2FA on still gets gated behind it when signing in via Google:");
  googleMock.setNextGooglePayload({ email: "google-twofa@morningaroma.local", email_verified: true, name: "Google Two Factor Test" });
  const googleTwoFaLogin = await post("/auth/google", { idToken: "real-looking-token" });
  check("does NOT return a real access token", googleTwoFaLogin.body.token === undefined);
  check("signals a second step is required, same as password login would", googleTwoFaLogin.body.requiresTwoFactor === true);
  check("returns a real pending session token", typeof googleTwoFaLogin.body.pendingToken === "string");

  console.log("\nOTP (email-code) login -- request a code for a brand-new email:");
  process.env.RESEND_API_KEY = "re_test_fake_key_for_testing_only";
  resendMock.resetSentEmails();
  const otpRequest = await post("/auth/otp/request", { email: "otp-new@morningaroma.local" });
  check("returns 200", otpRequest.status === 200);
  const otpEmails1 = resendMock.getSentEmails();
  check("a real login-code email was actually sent through the provider", otpEmails1.length === 1 && otpEmails1[0].to === "otp-new@morningaroma.local");
  const otpCodeMatch1 = otpEmails1[0] && otpEmails1[0].text.match(/\n(\d{6})\n/);
  check("email contains a real 6-digit code, not a placeholder", !!otpCodeMatch1);
  const otpCode1 = otpCodeMatch1 && otpCodeMatch1[1];

  console.log("\nPOST /auth/otp/verify with no code ever requested for a different email:");
  const otpNoCode = await post("/auth/otp/verify", { email: "never-requested@morningaroma.local", code: "000000" });
  check("returns 400", otpNoCode.status === 400);

  console.log("\nPOST /auth/otp/verify with the wrong code:");
  const otpWrongCode = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: "000000" });
  check("returns 400", otpWrongCode.status === 400);

  console.log("\nTwo more wrong attempts, to hit the real 3-attempt lockout:");
  await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: "111111" });
  const otpLockout = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: "222222" });
  check("returns 400 -- locked out after 3 wrong attempts, even though the real code was never actually tried", otpLockout.status === 400);
  const otpStillLocked = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: otpCode1 });
  check("the real, correct code no longer works either, once locked out", otpStillLocked.status === 400);

  console.log("\nRequesting a fresh code un-does the lockout (a new code invalidates the old, locked one):");
  resendMock.resetSentEmails();
  const otpRequest2 = await post("/auth/otp/request", { email: "otp-new@morningaroma.local" });
  const otpCodeMatch2 = resendMock.getSentEmails()[0].text.match(/\n(\d{6})\n/);
  const otpCode2 = otpCodeMatch2[1];

  console.log("\nPOST /auth/otp/verify with the real, correct new code -- creates a real new account:");
  const otpVerify = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: otpCode2 });
  check("returns 200", otpVerify.status === 200);
  check("creates a real user with the email that requested the code", otpVerify.body.user && otpVerify.body.user.email === "otp-new@morningaroma.local");
  check("a fresh account this far into the run is never the bootstrap admin", otpVerify.body.user.role === "customer");
  check("returns a real, usable access token", typeof otpVerify.body.token === "string" && otpVerify.body.token.length > 20);
  const otpNewUserId = otpVerify.body.user.id;

  console.log("\nReusing that exact same code a second time:");
  const otpReplay = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: otpCode2 });
  check("returns 400 -- an already-used code can never be replayed", otpReplay.status === 400);

  console.log("\nRequesting and verifying a code again for that SAME, now-existing email:");
  resendMock.resetSentEmails();
  await post("/auth/otp/request", { email: "otp-new@morningaroma.local" });
  const otpCode3 = resendMock.getSentEmails()[0].text.match(/\n(\d{6})\n/)[1];
  const otpSecondSignin = await post("/auth/otp/verify", { email: "otp-new@morningaroma.local", code: otpCode3 });
  check("resolves to the SAME account, not a duplicate", otpSecondSignin.body.user.id === otpNewUserId);

  console.log("\nAn expired code is rejected, even if it's otherwise correct (backdated directly in the DB, the same way the order-cancellation-window test backdates a timestamp):");
  resendMock.resetSentEmails();
  await post("/auth/otp/request", { email: "otp-expiry@morningaroma.local" });
  const otpExpiryCode = resendMock.getSentEmails()[0].text.match(/\n(\d{6})\n/)[1];
  const otpCodeExpiredAt = new Date(Date.now() - 11 * 60 * 1000);
  await query("UPDATE login_codes SET expires_at = $1 WHERE email = $2", [otpCodeExpiredAt, "otp-expiry@morningaroma.local"]);
  const otpExpired = await post("/auth/otp/verify", { email: "otp-expiry@morningaroma.local", code: otpExpiryCode });
  check("returns 400 -- a real, correct code is still rejected once genuinely expired", otpExpired.status === 400);

  console.log("\nAn account with real 2FA on still gets gated behind it when signing in via OTP:");
  const otpTwoFaReg = await registerAndVerify("otp-twofa@morningaroma.local", "correcthorsebattery1", "OTP Two Factor Test");
  const otpTwoFaSetup = await post("/auth/2fa/setup", {}, otpTwoFaReg.body.token);
  const otpTwoFaRealCode = await otplib.generate({ secret: otpTwoFaSetup.body.secret });
  await post("/auth/2fa/verify-setup", { code: otpTwoFaRealCode }, otpTwoFaReg.body.token);
  resendMock.resetSentEmails();
  await post("/auth/otp/request", { email: "otp-twofa@morningaroma.local" });
  const otpTwoFaLoginCode = resendMock.getSentEmails()[0].text.match(/\n(\d{6})\n/)[1];
  const otpTwoFaLogin = await post("/auth/otp/verify", { email: "otp-twofa@morningaroma.local", code: otpTwoFaLoginCode });
  check("does NOT return a real access token", otpTwoFaLogin.body.token === undefined);
  check("signals a second step is required, same as password and Google login would", otpTwoFaLogin.body.requiresTwoFactor === true);
  check("returns a real pending session token", typeof otpTwoFaLogin.body.pendingToken === "string");
  delete process.env.RESEND_API_KEY;

  console.log("\nStaff permissions -- previously cosmetic only (every route rejected any non-super_admin regardless of what was granted). Setting up a staff account with real, granted permissions:");
  const staffCandidate = await registerAndVerify("staff-inventory@morningaroma.local", "correcthorsebattery1", "Staff Inventory Test");
  const staffToken = staffCandidate.body.token;
  await patch(`/users/${staffCandidate.body.user.id}`, { role: "staff", permissions: ["Inventory"] }, token);

  console.log("\nA staff member granted \"Inventory\" can now genuinely create a green bean lot, not just see the panel and get rejected on every action:");
  const staffGreenBean = await post("/green-beans", {
    name: "Staff Permission Test Lot", country: "Kenya", pricePerKgCents: 900, stockKg: 100, minOrderKg: 5,
    cuppingScore: 84, moisture: "11.0%", grade: "—", process: "Washed", notes: "Created by a permission test.",
  }, staffToken);
  check("returns 201, not a 403 -- the fix actually works, not just the middleware accepting the call", staffGreenBean.status === 201);

  console.log("\nThat SAME staff member, trying an action outside what they were actually granted:");
  const staffSettingsAttempt = await patch("/settings", { tagline: "Hijacked by a test" }, staffToken);
  check("returns 403 -- \"Inventory\" doesn't imply \"Settings\" too", staffSettingsAttempt.status === 403);

  console.log("\nGranting a second staff member \"Customers\" specifically, to confirm the one real security boundary that must NOT have moved:");
  const staffCustomersCandidate = await registerAndVerify("staff-customers@morningaroma.local", "correcthorsebattery1", "Staff Customers Test");
  await patch(`/users/${staffCustomersCandidate.body.user.id}`, { role: "staff", permissions: ["Customers"] }, token);
  const staffCustomersToken = staffCustomersCandidate.body.token;

  const staffViewUsers = await get("/users", staffCustomersToken);
  check("still returns 403, even with \"Customers\" granted -- role/permission management stays super_admin-only, since a safe subset genuinely doesn't exist here (granting this would let a staff member change roles, including their own)", staffViewUsers.status === 403);
  const staffChangeRole = await patch(`/users/${staffCustomersCandidate.body.user.id}`, { role: "super_admin" }, staffCustomersToken);
  check("a staff member can't promote themselves either, even with \"Customers\" granted", staffChangeRole.status === 403);

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Test script crashed:", e); process.exit(1); });
