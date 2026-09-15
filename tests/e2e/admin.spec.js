import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { submitWithRateLimitBackoff } from "./rate-limit-helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth", "admin.json");
const BACKEND_URL = "https://upbeat-rebirth-production.up.railway.app";

// Real session auth now lives entirely in an httpOnly cookie (ma_session), not localStorage --
// confirmed directly against the app's own source (grep for ma_auth_token anywhere in src/
// returns nothing at all), so there was never a token to extract here in the first place.
//
// adminVerifyUserEmail is called from a test whose whole point is a real, non-admin CUSTOMER's
// own registration and sign-in flow -- `page` must stay that customer's genuine identity
// throughout, not silently become the admin (this test's describe block, unlike the later
// "Admin dashboard" one below, never applies storageState: authFile to `page` at all). The admin
// identity is only ever needed for this one background API call to verify the new customer's
// email. playwright.request.newContext({ storageState: authFile }) creates a real, genuinely
// isolated APIRequestContext carrying the admin's saved cookies, independent of `page`'s own
// cookie jar -- the standard, documented way to keep a test's UI identity and its background API
// identity from bleeding into each other.
//
// CSRF still needs a real, fresh token though -- it's held in memory on the real page's own JS
// (src/utils/api.js's inMemoryCsrfToken), never in a cookie or localStorage, so it genuinely
// can't be captured by storageState() at all, only re-fetched. /auth/me mints and returns a
// fresh one on every call (server/src/routes/auth.js) specifically for this reason -- calling it
// here gets a real, currently-valid token for the mutating request that follows, the same way
// the real page itself would on load.
async function getAdminCsrfToken(adminRequest) {
  const meRes = await adminRequest.get(`${BACKEND_URL}/auth/me`);
  const meBody = await meRes.json();
  if (!meBody.csrfToken) throw new Error("getAdminCsrfToken: /auth/me didn't return a csrfToken -- is the saved admin session (tests/e2e/.auth/admin.json) still valid?");
  return meBody.csrfToken;
}

// Marks a freshly-registered account's email as verified via a direct, admin-authenticated API
// call, instead of trying to read the real verification code from a real inbox -- which
// Playwright genuinely can't do against the real, live backend.
// Retries both real network calls up to 3 times -- a real, transient ECONNRESET has been seen
// here, the same class of occasional network flakiness already hardened against elsewhere in
// this suite (see signIn/openAdminDashboard's own history), not a code bug worth chasing further.
async function adminVerifyUserEmail(playwrightInstance, email) {
  const adminRequest = await playwrightInstance.request.newContext({ storageState: authFile });
  try {
    let newUser;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const usersRes = await adminRequest.get(`${BACKEND_URL}/users`);
        const usersBody = await usersRes.json();
        newUser = usersBody.users.find((u) => u.email === email);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!newUser) throw new Error(`adminVerifyUserEmail: no user found with email ${email} -- did registration actually succeed?`);

    const csrfToken = await getAdminCsrfToken(adminRequest);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await adminRequest.patch(`${BACKEND_URL}/users/${newUser.id}`, {
          headers: { "x-csrf-token": csrfToken },
          data: { emailVerified: true },
        });
        return newUser.id;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } finally {
    // Always disposed, pass or fail -- an APIRequestContext left open doesn't clean itself up.
    await adminRequest.dispose();
  }
}

// Real admin credentials, provided locally by whoever runs these tests -- never hardcoded here.
// These tests genuinely sign in against the real, deployed backend (see ROADMAP.md; auth has
// been real for a long time now), so they need real credentials for an actual super_admin
// account. Skipped entirely (not failed) when these aren't set, so the rest of the suite still
// runs cleanly for anyone who hasn't set up admin credentials locally.
//
// Usage: PLAYWRIGHT_ADMIN_EMAIL=you@example.com PLAYWRIGHT_ADMIN_PASSWORD=yourpassword npx playwright test admin.spec.js
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// A single attempt via submitWithRateLimitBackoff (see rate-limit-helper.js), not the previous
// 3x-with-no-pause retry loop this file had. That loop's own comment claimed every real failure
// here traced back to ordinary transient backend latency, never a real app bug -- true as far as
// it went, but incomplete: a real run of this exact suite later hit the genuine production rate
// limit ("Too many attempts. Try again in a few minutes.") on a sibling file's identical sign-in
// flow, which a 3x-immediate-retry loop only makes worse (each retry is itself another real
// request against the same window). submitWithRateLimitBackoff's own 25s timeout already covers
// ordinary latency; its internal 90s backoff is what actually handles a genuine rate limit
// correctly.
async function signIn(page, email, password) {
  await page.goto("/");
  // Accept the local-storage consent banner first -- persistToken() only writes the auth token
  // to localStorage once consent is accepted (src/context/index.jsx:62-65). Without this,
  // sign-in only lives in in-memory React state for the current page load and silently
  // disappears on the next real page.goto() reload -- which this test does more than once.
  const consentBanner = page.getByRole("dialog", { name: "Local storage and error monitoring preferences" });
  if (await consentBanner.isVisible().catch(() => false)) {
    await consentBanner.getByRole("button", { name: "Accept" }).click();
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Scoped to the dialog specifically -- the modal's own submit button shares the exact text
  // "Sign in" with the nav button that opens it, which would otherwise match two visible
  // elements at once and fail Playwright's strict mode.
  const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill(password);
  // Targeted by type="submit" rather than by its text ("Sign in") -- the mode-toggle button
  // above shows that exact same text simultaneously (sign-in is the default mode), which would
  // otherwise match two visible elements at once and fail Playwright's strict mode.
  await submitWithRateLimitBackoff(page, dialog, dialog, "hidden");
}

// Waits for the Admin button and clicks it, retrying via one fresh reload if it doesn't appear in
// time -- used both right after a sign-in and for later mid-test navigation back to the
// dashboard. The nav renders two different admin entry points: a button that's always visible in
// the desktop nav for a super_admin (src/components/index.jsx:716), and a link with the same
// "go to admin" action but only inside the mobile hamburger menu, collapsed by default. This
// checks the one that's actually reachable without first opening that menu.
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

// Doesn't need admin credentials at all -- a freshly registered account is never admin by
// default (only the very first user ever registered becomes super_admin, which won't be true by
// the time this test runs against a real, already-used deployment), so this runs unconditionally
// regardless of whether PLAYWRIGHT_ADMIN_EMAIL/PASSWORD are set.
test.describe("Non-admin access is genuinely blocked, not just hidden from the nav", () => {
  // Real, sufficiently long timeout for the whole test, not Playwright's 30s default -- matches
  // the same fix already proven necessary in admin-advanced.spec.js: a bare default timeout can
  // kill a test mid-retry before hardening logic elsewhere even gets a fair chance.
  test.setTimeout(60000);

  test("a regular customer can't reach the admin dashboard", async ({ page, playwright }) => {
    const testEmail = `e2e-customer-${Date.now()}@example.com`;

    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    // Sign-in and sign-up are two fully separate modals now, not one modal with an internal tab
    // toggle -- "Create an account" (note "an", the real link text) closes the sign-in dialog and
    // opens a distinct one.
    const signInDialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
    await signInDialog.getByRole("button", { name: "Create an account", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create your Morning Aroma account" });
    await dialog.getByLabel("First name").fill("E2E");
    await dialog.getByLabel("Last name").fill("Test Customer");
    await dialog.getByLabel("Email").fill(testEmail);
    // Scoped and exact -- "Password" alone would also match "Confirm password" as a substring.
    await dialog.getByLabel("Password", { exact: true }).fill("correcthorsebattery123");
    await dialog.getByLabel("Confirm password").fill("correcthorsebattery123");

    // Real email verification now blocks sign-in until confirmed (see ROADMAP.md) -- confirms
    // the real "check your inbox" step genuinely appeared, then admin-verifies directly via the
    // API rather than trying to read a real code from a real inbox, which Playwright can't do
    // against the real, live backend. Not the actual point of this test (that's the dashboard
    // access check below), just the real setup needed to reach it. 25s per attempt, not 15s --
    // /register now does genuinely more real database work than it used to, and this was seen
    // timing out at 15s in real runs.
    await submitWithRateLimitBackoff(page, dialog, dialog.getByRole("heading", { name: "Check your inbox" }));
    await adminVerifyUserEmail(playwright, testEmail);
    // Cancelling the verify step returns to the sign-up form itself (still pre-filled -- real,
    // intended UX for fixing a mistyped email), not the sign-in modal, so resubmitting it here
    // would hit a real "account already exists" conflict rather than signing in. Switches to the
    // real sign-in modal via its own existing link instead.
    await dialog.getByRole("button", { name: "Start over with a different email", exact: false }).click();
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
    const signInDialog2 = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
    await signInDialog2.getByLabel("Email").fill(testEmail);
    await signInDialog2.getByLabel("Password").fill("correcthorsebattery123");
    await submitWithRateLimitBackoff(page, signInDialog2, signInDialog2, "hidden");

    // The nav button itself is conditionally rendered only for super_admin -- confirms that part
    // works, but isn't the real security boundary on its own (a hidden button is still just UI).
    await expect(page.getByRole("button", { name: "Admin" })).not.toBeVisible();

    // The actual test: a real, direct navigation to the admin URL, confirming the app itself
    // (not just the nav) refuses to show real admin content to a non-admin/staff user.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin access only" })).toBeVisible();
    await expect(page.getByText("This dashboard is restricted to the Morning Aroma team.")).toBeVisible();
  });
});

test.describe("Admin dashboard", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run these against the real backend.");
  // Reuses the one real admin sign-in already done by tests/e2e/admin-auth.setup.js, instead of
  // every test here independently signing in fresh -- the real, working fix for the rate-limiting
  // directly confirmed via Railway's own logs, not another guess at more retries.
  test.use({ storageState: authFile });
  // Real, sufficiently long timeout for every test in this block -- see the comment on the
  // describe block above for why.
  test.setTimeout(120000);

  test("signing in as super admin reaches the dashboard", async ({ page }) => {
    await page.goto("/");
    await openAdminDashboard(page);
    // "Total revenue" is a real KPI label AdminOverview always renders on entry, regardless of
    // data state -- confirmed directly against the source (src/admin/index.jsx), not assumed.
    // ("Signed in as" was found to only exist on the Checkout page, not here -- a real,
    // pre-existing bug in this exact assertion, now fixed.)
    await expect(page.getByText("Total revenue", { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test("adding a product and editing its price genuinely reflects on the real Shop page", async ({ page }) => {
    // A uniquely-named test product, not an edit to real, existing catalog data -- this test
    // creates and cleans up its own isolated data rather than risking a collision with a real
    // product or a previous, still-lingering test run.
    const productName = `E2E Test Bean ${Date.now()}`;

    // Currency auto-detects from the visitor's real IP (src/context/index.jsx, the ipwho.is fetch
    // around line 1512) and isn't persisted across reloads -- picking USD via the currency
    // switcher wouldn't hold, since this test does several real page.goto() reloads, each of
    // which re-runs that detection and overrides it again. Blocking the lookup instead relies on
    // the app's own intentional fallback (stay on USD if that fetch fails) for a deterministic
    // "$" match below, regardless of where this test actually runs from. Also a real, external
    // dependency that could introduce genuine slowness of its own on a test that navigates this
    // often.
    //
    // Blocks ipwho.is specifically -- the app migrated to it from ipapi.co (see that same real
    // comment in context/index.jsx for why: ipapi.co started failing with 429s in production).
    // This test blocked the old, no-longer-used endpoint for a while after that migration,
    // meaning the real fetch to ipwho.is went through untouched and this test's USD assumption
    // silently broke wherever it ran from a non-US IP -- confirmed directly: it failed against
    // KES, not the expected USD, in a real run.
    await page.route("https://ipwho.is/**", (route) => route.abort());

    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    await page.getByRole("button", { name: "+ Add new product" }).click();
    // Scoped to the form itself -- the footer's "Request a Quotation" form (present on every
    // page, including this one) has its own field also labeled "Name", which would otherwise
    // match two visible elements at once and fail Playwright's strict mode.
    const addForm = page.locator(".admin-add-form");
    await addForm.getByLabel("Name").fill(productName);
    await addForm.getByLabel("Price (USD)").fill("22.00");
    await addForm.getByLabel("Stock (units)").fill("40");
    // At least one aroma tag and one brew method are required by the real form validation.
    await addForm.getByText("nutty", { exact: true }).click();
    await addForm.getByText("Pour-Over", { exact: true }).click();
    await addForm.getByRole("button", { name: "Add product", exact: true }).click();
    await expect(page.getByText(`${productName} added to the catalog`)).toBeVisible({ timeout: 15000 });

    // The real point of this test: confirm it's genuinely reachable on the actual public Shop
    // page, not just present in the admin list.
    await page.goto("/shop");
    const shopCard = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCard).toBeVisible({ timeout: 15000 });
    await expect(shopCard.getByText("$22.00")).toBeVisible();

    // Now edit the price for real, and confirm the change genuinely persists and reflects --
    // not just that the admin form accepted the edit. Navigating back via openAdminDashboard
    // rather than a bare goto+click -- confirmed elsewhere in this suite that a plain click()
    // here can occasionally time out waiting on the session-restore call a fresh reload triggers.
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    const adminRow = page.locator(".admin-row").filter({ hasText: productName });
    await adminRow.getByRole("button", { name: "Edit price" }).click();
    await adminRow.locator(".admin-price-input").fill("18.50");
    await adminRow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminRow.getByText("$18.50")).toBeVisible({ timeout: 15000 });

    await page.goto("/shop");
    const shopCardAfterEdit = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCardAfterEdit.getByText("$18.50")).toBeVisible({ timeout: 15000 });

    // Cleanup -- discontinues the test product rather than leaving it in the real catalog.
    await page.goto("/");
    await openAdminDashboard(page);
    await page.getByRole("button", { name: "Products", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: productName }).getByRole("button", { name: "Discontinue" }).click();
  });
});
