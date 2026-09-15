import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { submitWithRateLimitBackoff } from "./rate-limit-helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth", "admin.json");
const BACKEND_URL = "https://upbeat-rebirth-production.up.railway.app";
// This file didn't need real admin credentials before -- it does now, only because completing a
// real registration requires admin-verifying the new account via a direct API call (Playwright
// can't read a real verification code from a real inbox against the live backend). Guarded the
// same way every other admin-dependent test in this suite already is, rather than crashing when
// these aren't set.
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// Real session auth now lives entirely in an httpOnly cookie (ma_session), not localStorage --
// confirmed directly against the app's own source (grep for ma_auth_token anywhere in src/
// returns nothing at all), so there was never a token to extract here in the first place.
//
// This test's whole point is that `page` itself is a real, unauthenticated GUEST throughout --
// loading the saved admin session onto `page`'s own context (test.use({ storageState })) would
// silently defeat that. The admin identity is only ever needed for a background API call to
// verify the newly-registered customer's email, a completely separate identity from the guest
// being tested. playwright.request.newContext({ storageState: authFile }) creates a real,
// genuinely isolated APIRequestContext carrying the admin's saved cookies, independent of
// `page`'s own (guest) cookie jar -- the standard, documented way to keep one test's UI identity
// and its background API identity from bleeding into each other.
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
async function adminVerifyUserEmail(adminRequest, email) {
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
}

test.describe("Aroma Quiz", () => {
  test("answering all 4 questions produces a matched variety", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.getByRole("button", { name: "Take the Aroma Quiz" }).click();
    await expect(page.getByText("question 1 of 4")).toBeVisible();

    // Answer all four questions — labels are unique per step so first-match is safe.
    await page.getByRole("button", { name: "Energized" }).click();
    await page.getByRole("button", { name: "Full and syrupy" }).click();
    await page.getByRole("button", { name: "Bright — bring the acidity" }).click();
    await page.getByRole("button", { name: "Mid-morning rush" }).click();

    await expect(page.getByText("your match")).toBeVisible();
    // A result heading in the form "<Variety> — <Country>" should be present.
    await expect(page.locator(".quiz-result h1")).toBeVisible();
  });
});

test.describe("Cart and checkout", () => {
  test("adding an item opens the cart drawer with the right contents", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.getByRole("link", { name: "Shop" }).click();
    await expect(page.getByRole("heading", { name: "Shop All Coffee" })).toBeVisible();

    const firstAddToCart = page.getByRole("button", { name: "Add to cart" }).first();
    await firstAddToCart.click();

    // Cart drawer should open automatically on add.
    await expect(page.getByText("Your bag")).toBeVisible();
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("guest checkout is gated behind sign-in, reaches the real Paystack payment step", async ({ page, playwright }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD -- completing registration now requires admin-verifying the new account.");
    // Real, sufficiently long timeout for the whole test, not Playwright's 30s default -- this
    // is a multi-step flow (registration, then several real page transitions through checkout),
    // and the same class of occasional backend latency already hardened against elsewhere in
    // this suite can affect any one of those steps.
    test.setTimeout(60000);

    // A genuinely separate, isolated request context carrying the saved ADMIN session -- kept
    // completely apart from `page`'s own cookies, which must stay a real, unauthenticated guest
    // for the rest of this test to actually mean anything (see the block comment above
    // adminVerifyUserEmail for the full reasoning). Closed in a finally below so a failure
    // partway through this test doesn't leak the context into later tests/runs.
    const adminRequest = await playwright.request.newContext({ storageState: authFile });
    try {
      await page.goto("/");
      await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
      await page.getByRole("link", { name: "Shop" }).click();
      await page.getByRole("button", { name: "Add to cart" }).first().click();
      await page.getByRole("button", { name: "Checkout" }).click();

      // Not signed in yet — should land on the sign-in step, cart preserved.
      await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
      // Sign-in and sign-up are two fully separate modals now, not one combined "Sign in / Create
      // account" button.
      await page.getByRole("button", { name: "Create account", exact: true }).click();

      // Real password registration -- a self-contained, real request needing no email access at
      // all, unlike OTP (which genuinely emails a real code now that auth is fully real; there's no
      // on-screen demo code to read anymore). Real email verification now blocks sign-in until
      // confirmed too (see ROADMAP.md), so this admin-verifies the new account directly via the
      // API afterward -- Playwright can't read a real verification code from a real inbox against
      // the live backend -- rather than trying to read one.
      const testEmail = `e2e-test-${Date.now()}@example.com`;
      const dialog = page.getByRole("dialog", { name: "Create your Morning Aroma account" });
      await dialog.getByLabel("First name").fill("Test");
      await dialog.getByLabel("Last name").fill("Customer");
      await dialog.getByLabel("Email").fill(testEmail);
      // Scoped and exact -- "Password" alone would also match "Confirm password" as a substring.
      await dialog.getByLabel("Password", { exact: true }).fill("correcthorsebattery123");
      await dialog.getByLabel("Confirm password").fill("correcthorsebattery123");
      // 25s per attempt, not 15s -- /register now does genuinely more real database work (insert
      // the user, clear any old code, insert a new one) than it used to, and this was seen timing
      // out at 15s in real runs. See submitWithRateLimitBackoff's own comment for why this isn't
      // a bare click + wait anymore.
      await submitWithRateLimitBackoff(page, dialog, dialog.getByRole("heading", { name: "Check your inbox" }));
      await adminVerifyUserEmail(adminRequest, testEmail);
      // Cancelling the verify step returns to the sign-up form itself (still pre-filled -- real,
      // intended UX for fixing a mistyped email), not the sign-in modal, so resubmitting it here
      // would hit a real "account already exists" conflict rather than signing in. Switches to the
      // real sign-in modal via its own existing link instead.
      await dialog.getByRole("button", { name: "Start over with a different email", exact: false }).click();
      await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
      const signInDialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
      await signInDialog.getByLabel("Email").fill(testEmail);
      await signInDialog.getByLabel("Password").fill("correcthorsebattery123");
      // signInDialog becoming HIDDEN is the real success signal here (no separate heading to wait
      // for, unlike registration above) -- successState "hidden" tells the helper to wait for
      // that instead of "visible".
      await submitWithRateLimitBackoff(page, signInDialog, signInDialog, "hidden");

      await page.getByRole("button", { name: "Continue to shipping →" }).click();
      await page.getByLabel("Full name").fill("Test Customer");
      await page.getByLabel("Address").fill("123 Coffee Street");
      await page.getByLabel("City").fill("Nairobi");
      await page.getByLabel("Country").fill("Kenya");
      await page.getByRole("button", { name: "Continue to payment" }).click();

      // Real Paystack integration from here (see ROADMAP.md) -- the old fake card-entry form
      // (Name on card / Card number / Expiry / CVC, "Place Order (demo)") no longer exists at all.
      // Deliberately stops at confirming the real payment step is reached correctly with a working
      // "Pay with Paystack" button, rather than attempting to click through Paystack's own external
      // popup UI: that would need real network access to Paystack's script CDN (this test
      // environment has no guarantee of that), real test-mode payment credentials, and would be
      // testing Paystack's UI stability rather than this app's own code -- a third-party UI change
      // having nothing to do with this app could break that test for reasons outside this app's
      // control. This is the same reasoning already applied to why this test uses real password
      // registration above rather than a flow needing genuine email access.
      await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
      await expect(page.getByText("Pay securely with Paystack")).toBeVisible();
      const payButton = page.getByRole("button", { name: "Pay with Paystack" });
      await expect(payButton).toBeVisible();
      await expect(payButton).toBeEnabled();
    } finally {
      // Always disposed, pass or fail -- an APIRequestContext left open doesn't clean itself up,
      // and this test creates a fresh one on every run (unlike admin.spec.js's own storageState
      // usage, which just points a whole test at the file and lets Playwright's own test-level
      // context lifecycle handle disposal).
      await adminRequest.dispose();
    }
  });
});
