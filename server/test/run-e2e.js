// Exercises the real, unmodified production route logic (server/src/routes/auth.js) over real
// HTTP requests against a real (SQLite, for this sandbox) database — not a unit test with mocked
// internals. Swaps only the db module, via Node's require cache, before app.js (and therefore
// auth.js) is ever loaded.
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long-for-testing";
process.env.NODE_ENV = "test";

const path = require("path");
const dbPath = require.resolve(path.join(__dirname, "../src/db.js"));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: require("./db.sqlite.js") };

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
