import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth", "admin.json");
const BACKEND_URL = "https://upbeat-rebirth-production.up.railway.app";

// Reads the real admin token directly out of the saved session file the setup project already
// created (see admin-auth.setup.js) -- avoids yet another real /auth/login request just to get
// a token for these direct API calls, which would partly undo the whole reason that shared
// session exists (real rate-limiting, confirmed via Railway's own logs -- see ROADMAP.md).
// Playwright's storageState format nests localStorage under each real origin it captured; the
// app's own storage.set() JSON.stringifies before writing, so this needs one JSON.parse to
// unwrap back to the raw token string.
function getAdminToken() {
  const state = JSON.parse(readFileSync(authFile, "utf8"));
  const origin = state.origins.find((o) => o.localStorage.some((item) => item.name === "ma_auth_token"));
  const item = origin.localStorage.find((item) => item.name === "ma_auth_token");
  return JSON.parse(item.value);
}

// Marks a freshly-registered account's email as verified via a direct, admin-authenticated API
// call, instead of trying to read the real verification code from a real inbox -- which
// Playwright genuinely can't do against the real, live backend (no mock exists outside the
// backend's own unit tests). The pendingToken the UI holds only ever lives in React state, never
// exposed anywhere Playwright could read it from outside the app, so this looks the account up
// by the email it was just registered with instead, via the same admin capability real support
// staff would use for a customer having real email trouble.
// Retries both real network calls up to 3 times -- a real, transient ECONNRESET has been seen
// here, the same class of occasional network flakiness already hardened against elsewhere in
// this suite (see signIn/openAdminDashboard's own history), not a code bug worth chasing further.
async function adminVerifyUserEmail(page, email) {
  const adminToken = getAdminToken();

  let newUser;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const usersRes = await page.request.get(`${BACKEND_URL}/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const usersBody = await usersRes.json();
      newUser = usersBody.users.find((u) => u.email === email);
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!newUser) throw new Error(`adminVerifyUserEmail: no user found with email ${email} -- did registration actually succeed?`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.request.patch(`${BACKEND_URL}/users/${newUser.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { emailVerified: true },
      });
      return newUser.id;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// Same real admin credentials pattern as admin.spec.js -- these tests genuinely sign in against
// the real, deployed backend, so they need a real super_admin account. Skipped entirely (not
// failed) when unset, same reasoning as admin.spec.js.
//
// Usage: PLAYWRIGHT_ADMIN_EMAIL=you@example.com PLAYWRIGHT_ADMIN_PASSWORD=yourpassword npx playwright test admin-advanced.spec.js
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// Runs this file's tests one at a time, not in parallel -- several of them sign in as the real
// admin account more than once each, against the real production auth rate limiter (20 requests
// per 15 minutes per real visitor, correctly scoped per-IP as of today's own trust-proxy fix).
// Running them all in parallel workers genuinely risked tripping that same limiter for real,
// since every worker shares this one machine's real IP -- serial execution is the honest fix,
// not raising the production limit just to make local test runs faster.
// The default per-test timeout (30s) was silently capping every test below what the retry logic
// inside signIn/openAdminDashboard/registerCustomer actually needs (up to 3 attempts at 25s
// each, a 75s worst case) -- Playwright was force-closing the whole test mid-retry once 30s
// elapsed, regardless of whether a retry was still genuinely in progress. 120s gives real
// headroom above that worst case, for every test in this file, not just the ones that happened
// to hit it first.
test.describe.configure({ mode: "serial", timeout: 120000 });

test.beforeEach(async ({ page }) => {
  // Real IP-based currency/geo detection fires on every real page load (src/context/index.jsx's
  // CurrencyProvider) -- admin.spec.js already blocks this exact call for the same reason: it's
  // a genuine, uncontrolled external dependency (not this app's own code) that can be slow or
  // unreliable from a test runner's network path, and this file's tests re-navigate far more
  // often than admin.spec.js's single product-CRUD test does, giving it far more chances to
  // introduce real, non-deterministic slowness that has nothing to do with the actual feature
  // being tested.
  await page.route("https://ipapi.co/**", (route) => route.abort());
});

// Retries up to 3 times on failure -- confirmed via real traces (not assumed) that every actual
// auth request this suite's tests ever made got a real 200 back; the app and backend are proven
// correct. What's occasionally flaky is these specific steps themselves, in tests that chain
// several sign-in/sign-out/registration cycles back to back -- the click on submit intermittently
// doesn't result in a request completing in time, with no error of its own. Genuine, if
// occasional, backend latency has shown up across login, registration, and session-restore alike,
// not just one specific action -- so this uses a longer timeout (25s) and more attempts (3) than
// the first pass at this, rather than assuming any one specific action was uniquely the problem.
async function signIn(page, email, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/");
    // Conditional, not unconditional -- this can genuinely run more than once within the same
    // test, and the consent banner only ever appears once per session. Trying to click it a
    // second time, when it's already been dismissed and isn't there, would otherwise just hang
    // waiting for an element that doesn't exist.
    const consentBanner = page.getByRole("dialog", { name: "Local storage preferences" });
    if (await consentBanner.isVisible().catch(() => false)) {
      await consentBanner.getByRole("button", { name: "Accept" }).click();
    }
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill(password);
    await dialog.locator('button[type="submit"]').click();
    const signedIn = await dialog.waitFor({ state: "hidden", timeout: 25000 }).then(() => true).catch(() => false);
    if (signedIn) return;
    if (attempt === 3) throw new Error(`signIn: the dialog never closed for ${email}, even after 2 retries.`);
  }
}

// Same reasoning and same 3-attempt/25s pattern as signIn above.
async function openAdminDashboard(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const adminButton = page.getByRole("button", { name: "Admin" });
    const appeared = await adminButton.waitFor({ state: "visible", timeout: 25000 }).then(() => true).catch(() => false);
    if (appeared) {
      await adminButton.click();
      return;
    }
    if (attempt === 3) throw new Error("openAdminDashboard: the Admin button never appeared, even after 2 reload retries.");
    await page.reload();
  }
}

async function signInAsAdmin(page) {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await openAdminDashboard(page);
}

// Registers through the real sign-up form, admin-verifies the account via a direct API call
// (see adminVerifyUserEmail above -- Playwright can't read a real code from a real inbox against
// the live backend), then signs in fresh through the real UI, which now succeeds immediately
// since the account is verified.
async function registerCustomer(page, email, password, name) {
  // Splits a single "name" string into first/last so every existing call site (just one, today)
  // doesn't need updating for the new two-field form -- "E2E Staff Test" becomes "E2E" / "Staff
  // Test", which is fine; nothing in this suite actually asserts on the exact split.
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || "Test";

  await page.goto("/");
  const consentBanner = page.getByRole("dialog", { name: "Local storage preferences" });
  if (await consentBanner.isVisible().catch(() => false)) {
    await consentBanner.getByRole("button", { name: "Accept" }).click();
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Sign-in and sign-up are two fully separate modals now, not one modal with an internal tab
  // toggle -- "Create an account" (note "an", the real link text) closes the sign-in dialog and
  // opens a distinct one.
  const signInDialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
  await signInDialog.getByRole("button", { name: "Create an account", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create your Morning Aroma account" });
  await dialog.getByLabel("First name").fill(firstName);
  await dialog.getByLabel("Last name").fill(lastName);
  await dialog.getByLabel("Email").fill(email);
  // Scoped and exact -- "Password" alone would also match "Confirm password" as a substring.
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByLabel("Confirm password").fill(password);
  await dialog.locator('button[type="submit"]').click();

  // Real email verification now blocks sign-in until confirmed (see ROADMAP.md) -- confirms the
  // real "check your inbox" step genuinely appeared, then admin-verifies the account directly
  // via the API rather than trying to read a real code from a real inbox, which Playwright
  // can't do against the real, live backend. 25s, not 15s -- /register now does genuinely more
  // real database work (insert the user, clear any old code, insert a new one) than it used to,
  // and this was seen timing out at 15s in real runs.
  await expect(dialog.getByRole("heading", { name: "Check your inbox" })).toBeVisible({ timeout: 25000 });
  await adminVerifyUserEmail(page, email);

  // The UI has no way to know verification happened elsewhere -- starts over with a fresh sign-in
  // through the real form instead, which now succeeds immediately since the account is verified.
  await dialog.getByRole("button", { name: "Start over with a different email", exact: false }).click();
  await signIn(page, email, password);
  await page.getByRole("button", { name: "Sign out" }).click();
}

test.describe("Admin — advanced coverage", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run these against the real backend.");

  test.describe("staff permissions", () => {
    // Deliberately NOT using the shared admin session here -- this test's very first real step is
    // registering a brand-new customer, which needs to start genuinely signed out (an
    // already-authenticated admin session would mean the nav shows "Admin"/"Sign out" instead of
    // "Sign in", breaking registerCustomer's first click entirely). This test keeps doing real,
    // live sign-ins throughout, exactly as before -- it doesn't benefit from the shared session
    // the way the other tests below do, since account-switching is the actual point of it.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("staff permissions are genuinely enforced, not just hidden from the sidebar", async ({ page }) => {
      // A real, uniquely-named customer this test creates and promotes itself, not an edit to a
      // real existing account -- same isolation principle as the product CRUD test's own uniquely-
      // named test product.
      const staffEmail = `e2e-staff-${Date.now()}@example.com`;
      const staffPassword = "correcthorsebattery123";
      await registerCustomer(page, staffEmail, staffPassword, "E2E Staff Test");

      await signInAsAdmin(page);
    await page.getByRole("button", { name: "Customers", exact: true }).click();
    // Searches rather than assuming the freshly-registered account is on the first page -- the
    // customer list can genuinely be paginated once a deployment has enough real users.
    await page.getByPlaceholder("Search by name, email, or role…").fill(staffEmail);
    const customerRow = page.locator(".admin-row").filter({ hasText: staffEmail });
    // "Make staff" saves immediately (role: staff, permissions: []) -- there's no separate Save
    // step for this specific action, and it opens the permissions panel as a side effect.
    await customerRow.getByRole("button", { name: "Make staff" }).click();
    // The permissions checkboxes render as a sibling section below the row, not inside it, so
    // this is scoped from the page, not from customerRow. Each chip is a <label> whose own text
    // content IS "Inventory" (the checkbox inside it has no text of its own) -- getByText already
    // resolves to that label directly, so no extra parent traversal is needed here.
    const permissionsPanel = page.locator(".admin-permissions-row").filter({ has: page.getByText("Inventory", { exact: true }) });
    const inventoryChip = permissionsPanel.getByText("Inventory", { exact: true });
    await inventoryChip.click();
    // Grants save immediately too (togglePermission -> updateUser, no separate button) -- this
    // waits on the chip's own real active-state class rather than a toast, since this specific
    // action doesn't show one.
    await expect(inventoryChip).toHaveClass(/chip-active/, { timeout: 15000 });

    // Now sign in AS that staff account, on a clean slate. Explicitly signing out first --
    // page.goto() alone wouldn't clear the admin's persisted session (the auth token survives
    // navigation via localStorage), so "Sign in" wouldn't even be present without this.
    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, staffEmail, staffPassword);
    await openAdminDashboard(page);

    // Only Overview (always given) and Inventory (just granted) should be reachable -- not
    // Orders, Customers, Settings, or anything else.
    await expect(page.getByRole("button", { name: "Inventory", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Orders", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).not.toBeVisible();

    // The real proof this is genuinely fixed, not just that the button is visible: an actual
    // green bean lot creation, previously rejected with a real 403 regardless of what the UI
    // showed.
    const lotName = `E2E Staff Lot ${Date.now()}`;
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await page.getByRole("button", { name: "+ Add green lot" }).click();
    const greenForm = page.locator(".admin-add-form");
    await greenForm.getByLabel("Name").fill(lotName);
    await greenForm.getByLabel("Price per kg (USD)").fill("7.50");
    await greenForm.getByLabel("Stock (kg)").fill("150");
    await greenForm.getByRole("button", { name: "Add green lot", exact: true }).click();
    await expect(page.getByText(`${lotName} added to the green coffee catalog`)).toBeVisible({ timeout: 15000 });

    // Cleanup: sign back in as super admin, discontinue the test lot, and reset the test
    // account back to a plain customer so re-running this test doesn't collide with a leftover
    // staff account.
    await page.getByRole("button", { name: "Sign out" }).click();
    await signInAsAdmin(page);
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: lotName }).getByRole("button", { name: "Discontinue" }).click();

    await page.getByRole("button", { name: "Customers", exact: true }).click();
    await page.getByPlaceholder("Search by name, email, or role…").fill(staffEmail);
    await page.locator(".admin-row").filter({ hasText: staffEmail }).getByRole("button", { name: "Revoke staff" }).click();
    });
  });

  test.describe("other admin coverage", () => {
    // Reuses the one real admin sign-in already done by tests/e2e/admin-auth.setup.js, instead of
    // every test here independently signing in fresh -- the real, working fix for the rate-limiting
    // directly confirmed via Railway's own logs, not another guess at more retries. Unlike the
    // staff permissions test above, none of these need to start signed out.
    test.use({ storageState: authFile });

    test("adding a green coffee lot and editing its stock genuinely reflects on the real public Green Coffee page", async ({ page }) => {
    const lotName = `E2E Green Lot ${Date.now()}`;

    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await page.getByRole("button", { name: "+ Add green lot" }).click();
    const greenForm = page.locator(".admin-add-form");
    await greenForm.getByLabel("Name").fill(lotName);
    await greenForm.getByLabel("Price per kg (USD)").fill("8.25");
    await greenForm.getByLabel("Stock (kg)").fill("200");
    await greenForm.getByRole("button", { name: "Add green lot", exact: true }).click();
    // The real toast text is "${name} added to the green coffee catalog" -- not to be confused
    // with the similarly-worded but separate internal audit-log entry ("Green bean lot added"),
    // which only ever shows up in the Audit Log section, never as a toast.
    await expect(page.getByText(`${lotName} added to the green coffee catalog`)).toBeVisible({ timeout: 15000 });

    // The real point: genuinely reachable on the actual public page, not just present in the
    // admin list.
    await page.goto("/green-beans");
    const publicCard = page.locator(".green-bean-card").filter({ hasText: lotName });
    await expect(publicCard).toBeVisible({ timeout: 15000 });
    await expect(publicCard.getByText("200kg in stock")).toBeVisible();

    // Now edit the stock for real and confirm it genuinely persists and reflects. StockCell
    // (admin/index.jsx) renders the number and unit concatenated with no space ("200kg", not
    // "200") and reveals a real Save button on click -- not an Enter-to-submit input. Navigating
    // back via openAdminDashboard rather than a bare goto+click -- confirmed via a real trace
    // that a plain click() here could time out waiting on the session-restore call a fresh
    // reload triggers, even though that same call always succeeded when it fired.
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    const adminRow = page.locator(".admin-row").filter({ hasText: lotName });
    await adminRow.getByText("200kg", { exact: true }).click();
    await adminRow.locator(".admin-price-input").fill("40");
    await adminRow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminRow.getByText("Low")).toBeVisible({ timeout: 15000 });

    await page.goto("/green-beans");
    const publicCardAfterEdit = page.locator(".green-bean-card").filter({ hasText: lotName });
    await expect(publicCardAfterEdit.getByText("40kg in stock")).toBeVisible({ timeout: 15000 });

    // Cleanup.
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: lotName }).getByRole("button", { name: "Discontinue" }).click();
  });

  test("downloading a real order invoice PDF", async ({ page }) => {
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Invoices", exact: true }).click();

    // Skips cleanly rather than failing if there's genuinely no order yet to download an
    // invoice for -- a fresh deployment or a test environment with zero real orders shouldn't
    // fail this test, since there's nothing wrong with the invoice feature itself in that case.
    const downloadButton = page.getByRole("button", { name: "Download PDF" }).first();
    const hasOrder = await downloadButton.isVisible().catch(() => false);
    test.skip(!hasOrder, "No real orders exist yet to download an invoice for.");

    // Invoice generation is entirely client-side (utils/pdf.js, jsPDF) -- a real blob download,
    // not a network request, so this is what actually proves it works: a real file, not just a
    // click registering.
    const downloadPromise = page.waitForEvent("download");
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test("submitting a real quotation makes it show up in the admin notification bell", async ({ page }) => {
    // Quotations are still genuinely in-memory, client-side-only state (see ROADMAP.md) -- not
    // persisted to a real database yet, unlike products/orders/users elsewhere in this suite.
    // That means it only exists for the lifetime of one continuous page session: a fresh
    // page.goto() (which openAdminDashboard's own reload-retry could otherwise trigger) would
    // fully reload the app and wipe it before ever reaching the bell. Submits the quotation
    // first, on this same already-open page, before ever navigating into the dashboard.
    const contactName = `E2E Notification Test ${Date.now()}`;
    const contactEmail = `e2e-notif-${Date.now()}@example.com`;

    // Already signed in as admin from the start, via the shared session -- no separate sign-in
    // step needed here anymore.
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.getByLabel("Name").fill(contactName);
    await page.getByLabel("Email").fill(contactEmail);
    await page.getByLabel("Variety of interest").selectOption({ label: "Not sure yet" });
    await page.getByLabel("Estimated quantity").fill("40kg/month");
    await page.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.getByText("Thank you")).toBeVisible();

    await openAdminDashboard(page);

    // The bell aggregates every section's own pending count -- a fresh quotation (status "New")
    // should genuinely make it appear here, not just in the Quotations list itself.
    await page.getByRole("button", { name: /notifications/i }).click();
    const bellPanel = page.getByRole("menu");
    await expect(bellPanel.getByText("Quotations", { exact: true })).toBeVisible();

    // Clicking it should navigate straight to the real section, not just close the panel.
    await bellPanel.getByText("Quotations", { exact: true }).click();
    // Confirmed via a real run that this heading genuinely exists ("Quotations", not something
    // else) -- both this and the contact name are actually visible at once on a real success,
    // which is exactly why the earlier .or() version failed Playwright's strict mode: it isn't a
    // fallback situation, both are simultaneously true, so checking just one directly is correct.
    await expect(page.getByRole("heading", { name: "Quotations" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(contactName)).toBeVisible();
  });

  test("settings backup and restore round-trips real in-memory admin data", async ({ page }) => {
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    // Downloads a real backup file and confirms it's genuinely valid, structured JSON -- not
    // just that a click happened.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/morning-aroma-backup-.*\.json$/);
    const path = await download.path();
    const contents = JSON.parse(readFileSync(path, "utf8"));
    expect(contents.version).toBe(1);
    expect(contents).toHaveProperty("admin");
    expect(contents).toHaveProperty("users");

    // Restoring that exact same file back should succeed cleanly and confirm via a real toast --
    // this doesn't change any real data (it's the same file just downloaded), but proves the
    // restore path genuinely parses and applies a real backup, not a fabricated one.
    page.once("dialog", (dialog) => dialog.accept());
    await page.setInputFiles('input[type="file"][accept="application/json"]', path);
    await expect(page.getByText("Backup restored")).toBeVisible({ timeout: 15000 });
  });

  test("uploading a real product photo genuinely goes through Cloudinary, not just a local preview", async ({ page }) => {
    // Fetches the real, current catalog directly (GET /products needs no auth) to pick a real
    // existing product and capture its real, current photo first -- this test modifies a real
    // product's photo, not test-only data it creates and can freely discard, so the original
    // value needs to be genuinely restorable afterward, not just left changed.
    const before = await page.request.get(`${BACKEND_URL}/products`).then((r) => r.json());
    const product = before.products[0];

    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    await page.getByPlaceholder("Search by name, country, or tier…").fill(product.name);
    const productRow = page.locator(".admin-row").filter({ hasText: product.name });

    // A real image file already committed to the repo (public/og-image.jpg), not a fabricated
    // test fixture -- setInputFiles works directly on the hidden input, same effect as a real
    // file-picker selection, even though it's visually hidden behind the "Change photo" label.
    // An absolute path built from this file's own location -- a relative path here was found to
    // silently fail (e.target.files[0] ended up empty in the real onChange handler, which exits
    // immediately with no toast and no network request at all when that happens, matching every
    // symptom seen when this was first tried), so this removes any ambiguity about what a
    // relative path actually resolves against.
    const testImagePath = path.join(__dirname, "..", "..", "public", "og-image.jpg");
    await productRow.locator('input[type="file"]').setInputFiles(testImagePath);
    await expect(page.getByText("Photo updated")).toBeVisible({ timeout: 15000 });

    // The real proof: not just that a toast appeared, but that the actually-stored URL is now a
    // genuine, permanent Cloudinary-hosted one -- confirming the full real pipeline (client-side
    // resize -> backend -> Cloudinary -> a real, public URL), not a client-only preview that
    // never actually left the browser.
    const after = await page.request.get(`${BACKEND_URL}/products`).then((r) => r.json());
    const updatedProduct = after.products.find((p) => p.id === product.id);
    expect(updatedProduct.photoUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    // Restores the real product's original photo -- this test intentionally touches real,
    // existing catalog data, so it must leave that data exactly as it found it, not just move on
    // once the assertion above passes.
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("ma_auth_token") || "null"));
    await page.request.patch(`${BACKEND_URL}/products/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { photoUrl: product.photoUrl },
    });
  });

  test("editing a product's name, country, and tier genuinely persists and reflects on the real Shop page", async ({ page }) => {
    // Previously, once a product was created, only price, stock, and photo could ever be
    // changed -- there was no way to fix a typo in the name, correct the country, or move a
    // product between tiers without discontinuing it and starting over. A self-contained test
    // product, not real catalog data -- created, edited, verified, then discontinued, same
    // isolation principle as the green coffee lot test.
    const originalName = `E2E Edit Test ${Date.now()}`;
    const updatedName = `${originalName} (Updated)`;

    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    await page.getByRole("button", { name: "+ Add new product" }).click();
    const addForm = page.locator(".admin-add-form");
    await addForm.getByLabel("Name").fill(originalName);
    await addForm.getByLabel("Country").selectOption({ label: "Kenya" });
    await addForm.getByLabel("Tier").selectOption({ label: "Everyday" });
    await addForm.getByLabel("Price (USD)").fill("15.00");
    await addForm.getByLabel("Stock (units)").fill("50");
    await addForm.getByText("floral", { exact: true }).click();
    await addForm.getByText("Pour-Over", { exact: true }).click();
    await addForm.getByRole("button", { name: "Add product", exact: true }).click();
    await expect(page.getByText(`${originalName} added to the catalog`)).toBeVisible({ timeout: 15000 });

    // Now the real point: editing name, country, and tier on that existing product.
    await page.getByPlaceholder("Search by name, country, or tier…").fill(originalName);
    const productRow = page.locator(".admin-row").filter({ hasText: originalName });
    await productRow.getByRole("button", { name: "Edit details", exact: true }).click();
    const editForm = page.locator(".admin-add-form");
    await expect(editForm.getByText(`Editing ${originalName}`)).toBeVisible();
    await editForm.getByLabel("Name").fill(updatedName);
    await editForm.getByLabel("Country").selectOption({ label: "Ethiopia" });
    await editForm.getByLabel("Tier").selectOption({ label: "Premium" });
    await editForm.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText(`${updatedName} updated`)).toBeVisible({ timeout: 15000 });

    // The real proof: genuinely reachable, with the updated details, on the actual public Shop
    // page -- not just changed in the admin list. .origin-row is the real card class, confirmed
    // directly against Shop.jsx, not guessed.
    await page.goto("/shop");
    const shopCard = page.locator(".origin-row").filter({ hasText: updatedName });
    await expect(shopCard).toBeVisible({ timeout: 15000 });
    await expect(shopCard.getByText("Ethiopia").first()).toBeVisible();

    // Cleanup.
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    await page.getByPlaceholder("Search by name, country, or tier…").fill(updatedName);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: updatedName }).getByRole("button", { name: "Discontinue" }).click();
    });
  });
});
