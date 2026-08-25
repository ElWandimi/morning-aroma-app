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
  await expect(page.getByRole("link", { name: "Admin Dashboard" })).toBeVisible();
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
    await expect(dialog).toBeHidden();

    // The nav link itself is conditionally rendered only for super_admin -- confirms that part
    // works, but isn't the real security boundary on its own (a hidden link is still just UI).
    await expect(page.getByRole("link", { name: "Admin Dashboard" })).not.toBeVisible();

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
    await page.getByRole("link", { name: "Admin Dashboard" }).click();
    await expect(page.getByText(/Signed in as/i)).toBeVisible();
  });

  test("adding a product and editing its price genuinely reflects on the real Shop page", async ({ page }) => {
    // A uniquely-named test product, not an edit to real, existing catalog data -- this test
    // creates and cleans up its own isolated data rather than risking a collision with a real
    // product or a previous, still-lingering test run.
    const productName = `E2E Test Bean ${Date.now()}`;

    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Admin Dashboard" }).click();
    await page.getByRole("button", { name: "Products", exact: true }).click();

    await page.getByRole("button", { name: "+ Add new product" }).click();
    await page.getByLabel("Name").fill(productName);
    await page.getByLabel("Price (USD)").fill("22.00");
    await page.getByLabel("Stock (units)").fill("40");
    // At least one aroma tag and one brew method are required by the real form validation.
    await page.getByText("nutty", { exact: true }).click();
    await page.getByText("Pour-Over", { exact: true }).click();
    await page.getByRole("button", { name: "Add product", exact: true }).click();
    await expect(page.getByText(`${productName} added to the catalog`)).toBeVisible();

    // The real point of this test: confirm it's genuinely reachable on the actual public Shop
    // page, not just present in the admin list -- this is exactly the gap the previous session's
    // README explicitly flagged as missing.
    await page.goto("/shop");
    const shopCard = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCard).toBeVisible();
    await expect(shopCard.getByText("$22.00")).toBeVisible();

    // Now edit the price for real, and confirm the change genuinely persists and reflects --
    // not just that the admin form accepted the edit.
    await page.goto("/");
    await page.getByRole("link", { name: "Admin Dashboard" }).click();
    await page.getByRole("button", { name: "Products", exact: true }).click();
    const adminRow = page.locator(".admin-row").filter({ hasText: productName });
    await adminRow.getByRole("button", { name: "Edit price" }).click();
    await adminRow.locator(".admin-price-input").fill("18.50");
    await adminRow.getByRole("button", { name: "Save", exact: true }).click();
    await expect(adminRow.getByText("$18.50")).toBeVisible();

    await page.goto("/shop");
    const shopCardAfterEdit = page.locator(".origin-row").filter({ hasText: productName });
    await expect(shopCardAfterEdit.getByText("$18.50")).toBeVisible();

    // Cleanup -- discontinues the test product rather than leaving it in the real catalog.
    await page.goto("/");
    await page.getByRole("link", { name: "Admin Dashboard" }).click();
    await page.getByRole("button", { name: "Products", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".admin-row").filter({ hasText: productName }).getByRole("button", { name: "Discontinue" }).click();
  });
});
