import { test, expect } from "@playwright/test";

// Real admin credentials, provided locally by whoever runs these tests -- never hardcoded here.
// These tests genuinely sign in against the real, deployed backend (see ROADMAP.md; auth has
// been real for a long time now), so they need real credentials for an actual super_admin
// account. Skipped entirely (not failed) when these aren't set, so the rest of the suite still
// runs cleanly for anyone who hasn't set up admin credentials locally.
//
// Usage: PLAYWRIGHT_ADMIN_EMAIL=you@example.com PLAYWRIGHT_ADMIN_PASSWORD=yourpassword npx playwright test admin.spec.js
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

async function signInAsAdmin(page) {
  await page.goto("/");
  // Accept the local-storage consent banner first -- persistToken() only writes the auth token to
  // localStorage once consent is accepted (src/context/index.jsx:62-65). Without this, sign-in
  // only lives in in-memory React state for the current page load and silently disappears on the
  // next real page.goto() reload -- which this test does more than once later on.
  await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Scoped to the dialog specifically -- the modal's own submit button shares the exact text
  // "Sign in" with the nav button that opens it, which would otherwise match two visible
  // elements at once and fail Playwright's strict mode.
  const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
  await dialog.getByLabel("Email").fill(ADMIN_EMAIL);
  await dialog.getByLabel("Password").fill(ADMIN_PASSWORD);
  // Targeted by type="submit" rather than by its text ("Sign in") -- the mode-toggle button
  // above shows that exact same text simultaneously (sign-in is the default mode), which would
  // otherwise match two visible elements at once and fail Playwright's strict mode.
  await dialog.locator('button[type="submit"]').click();
  // The nav renders two different admin entry points: a button that's always visible in the
  // desktop nav for a super_admin (src/components/index.jsx:716), and a link with the same
  // "go to admin" action but only inside the mobile hamburger menu, which is collapsed by
  // default (src/components/index.jsx:734). This checks the one that's actually reachable
  // without first opening that menu.
  // Given a generous timeout rather than Playwright's 5s default -- this is waiting on a real
  // /auth/login round-trip to the actual deployed backend (see ROADMAP.md), not just a UI
  // render, and that can genuinely take longer than 5s if the backend needed a moment to
  // respond. 15s comfortably covers that while still failing fast if sign-in is truly broken.
  await expect(page.getByRole("button", { name: "Admin" })).toBeVisible({ timeout: 15000 });
}

// Doesn't need admin credentials at all -- a freshly registered account is never admin by
// default (only the very first user ever registered becomes super_admin, which won't be true by
// the time this test runs against a real, already-used deployment), so this runs unconditionally
// regardless of whether PLAYWRIGHT_ADMIN_EMAIL/PASSWORD are set.
test.describe("Non-admin access is genuinely blocked, not just hidden from the nav", () => {
  test("a regular customer can't reach the admin dashboard", async ({ page }) => {
    const testEmail = `e2e-customer-${Date.now()}@example.com`;

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();
    await dialog.getByLabel("Name").fill("E2E Test Customer");
    await dialog.getByLabel("Email").fill(testEmail);
    await dialog.getByLabel("Password").fill("correcthorsebattery123");
    // Targeted by type="submit" rather than by its text ("Create account") -- once in signup
    // mode, the mode-toggle button above shows that exact same text simultaneously, which would
    // otherwise match two visible elements at once and fail Playwright's strict mode.
    await dialog.locator('button[type="submit"]').click();
    // Given a generous timeout rather than Playwright's 5s default -- same reasoning as
    // signInAsAdmin's toBeVisible() above: this is waiting on a real /auth/register round-trip to
    // the actual deployed backend, not just a UI render, and that can genuinely take longer than
    // 5s if the backend needed a moment to respond.
    await expect(dialog).toBeHidden({ timeout: 15000 });

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

  test("signing in as super admin reaches the dashboard", async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByText(/Signed in as/i)).toBeVisible();
  });

  test("adding a product and editing its price genuinely reflects on the real Shop page", async ({ page }) => {
    // A uniquely-named test product, not an edit to real, existing catalog data -- this test
    // creates and cleans up its own isolated data rather than risking a collision with a real
    // product or a previous, still-lingering test run.
    const productName = `E2E Test Bean ${Date.now()}`;

    // Currency auto-detects from the visitor's real IP (src/context/index.jsx:841-851) and isn't
    // persisted across reloads -- picking USD via the currency switcher wouldn't hold, since this
    // test does several real page.goto() reloads, each of which re-runs that detection and
    // overrides it again. Blocking the lookup instead relies on the app's own intentional
    // fallback (stay on USD if that fetch fails) for a deterministic "$" match below, regardless
    // of where this test actually runs from.
    await page.route("https://ipapi.co/**", (route) => route.abort());

    await signInAsAdmin(page);
    await page.getByRole("button", { name: "Admin" }).click();
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
    // Same reasoning as signInAsAdmin's timeout above -- gated behind a real POST to the backend
    // creating the product, not just a UI update.
    await expect(page.getByText(`${productName} added to the catalog`)).toBeVisible({ timeout: 15000 });

    // The real point of this test: confirm it's genuinely reachable on the actual public Shop
    // page, not just present in the admin list -- this is exactly the gap the previous session's
    // README explicitly flagged as missing.
    await page.goto("/shop");
    const shopCard = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCard).toBeVisible({ timeout: 15000 });
    await expect(shopCard.getByText("$22.00")).toBeVisible();

    // Now edit the price for real, and confirm the change genuinely persists and reflects --
    // not just that the admin form accepted the edit.
    await page.goto("/");
    await page.getByRole("button", { name: "Admin" }).click();
    await page.getByRole("button", { name: "Products", exact: true }).click();
    const adminRow = page.locator(".admin-row").filter({ hasText: productName });
    await adminRow.getByRole("button", { name: "Edit price" }).click();
    await adminRow.locator(".admin-price-input").fill("18.50");
    await adminRow.getByRole("button", { name: "Save", exact: true }).click();
    // Same reasoning again -- gated behind a real PATCH updating the price on the backend.
    await expect(adminRow.getByText("$18.50")).toBeVisible({ timeout: 15000 });

    await page.goto("/shop");
    const shopCardAfterEdit = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCardAfterEdit.getByText("$18.50")).toBeVisible({ timeout: 15000 });

    // Cleanup -- discontinues the test product rather than leaving it in the real catalog.
    await page.goto("/");
    await page.getByRole("button", { name: "Admin" }).click();
    await page.getByRole("button", { name: "Products", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: productName }).getByRole("button", { name: "Discontinue" }).click();
  });
});