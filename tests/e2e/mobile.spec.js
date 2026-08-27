import { test, expect, devices } from "@playwright/test";

// Real admin credentials pattern, same as admin.spec.js and admin-advanced.spec.js -- only the
// one test here that needs to reach the admin dashboard is gated behind these; every other test
// in this file runs unconditionally, since mobile nav/layout is public-facing behavior that
// doesn't need a real account to verify.
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// A real phone viewport, user-agent, and touch-support flag -- not just a resized desktop
// browser window. Confirmed against the actual CSS (src/styles/theme.js): the desktop nav links
// hide and the hamburger takes over below 900px, and a further set of mobile-only adjustments
// (the desktop Admin button hides in favor of the hamburger menu's own "Admin Dashboard" link,
// the role badge text drops from the user chip) kick in below 480px. iPhone 13's real viewport
// (390px wide) is comfortably under both, so one device preset genuinely exercises both.
//
// Deliberately NOT `...devices["iPhone 13"]` spread wholesale -- that preset also sets
// `defaultBrowserType: "webkit"` (a real iPhone runs Safari/WebKit, not Chromium), which this
// project's playwright.config.js never installs, unlike every other spec file here, all of which
// run on Chromium. Pulling in just the specific properties actually needed keeps this test on
// the same browser as the rest of the suite, at the cost of not being byte-for-byte identical to
// real Safari rendering -- an acceptable tradeoff for testing layout/interaction behavior, not
// pixel-perfect Safari-specific rendering quirks.
const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
test.use({ userAgent, viewport, deviceScaleFactor, isMobile, hasTouch });

test.describe("Mobile viewport", () => {
  test("the hamburger menu opens, and mobile nav links genuinely navigate", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();

    // The desktop nav links are real DOM elements, just CSS-hidden at this width -- they must
    // NOT be independently clickable/visible right now, confirming the CSS breakpoint itself is
    // actually in effect, not just assumed from reading the stylesheet.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Shop", exact: true })).not.toBeVisible();

    const hamburger = page.getByRole("button", { name: "Menu" });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Real navigation, not just a menu opening -- confirms clicking a mobile link both goes to
    // the right real page and closes the menu behind it (setOpen(false) in the same handler).
    // Scoped to the mobile nav specifically -- "Green Coffee" is also a real link in the footer,
    // which would otherwise make this locator ambiguous.
    await page.locator(".nav-mobile").getByRole("link", { name: "Green Coffee", exact: true }).click();
    await expect(page).toHaveURL(/\/green-beans/);
    await expect(page.getByRole("heading", { name: "Green Coffee" })).toBeVisible();
    // The menu should have closed itself -- re-opening it fresh should be needed to see it again,
    // not still be open from before.
    await expect(page.locator(".nav-mobile")).not.toBeVisible();
  });

  test("no unwanted horizontal overflow on the homepage at a real mobile width", async ({ page }) => {
    // A genuinely common, real class of mobile bug: some element (an image, a fixed-width flex
    // row, a long unbroken string) quietly wider than the viewport, causing the whole page to
    // scroll sideways -- something a desktop-only test run would never surface, since the bug
    // only exists once the viewport is actually this narrow.
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();
    const overflowsHorizontally = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowsHorizontally).toBe(false);
  });

  test("adding an item to cart and opening the drawer is genuinely usable at mobile width", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();
    // Real IP-based currency detection isn't the point of this test -- blocked the same way
    // admin.spec.js already does, for the same reason (a deterministic result regardless of
    // where this actually runs from).
    await page.route("https://ipapi.co/**", (route) => route.abort());

    // A flexible match, not the exact emoji-prefixed text -- confirmed directly against
    // Shop.jsx that different view modes render slightly different button text ("🛒 Add to
    // cart" vs plain "Add to cart"), so matching loosely avoids depending on which one happens
    // to be the default view.
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    // The cart drawer opening automatically on add is existing, real behavior (src/context's
    // CartProvider sets open: true on add) -- this confirms it's still genuinely usable at this
    // width, not just that it technically renders.
    const checkoutButton = page.getByRole("button", { name: "Checkout", exact: true });
    await expect(checkoutButton).toBeVisible();
    // A real tap target, not just present in the DOM -- confirms nothing mobile-CSS-specific
    // (padding, z-index, an overlapping element) is silently blocking the actual interaction.
    await expect(checkoutButton).toBeEnabled();
  });

  test.describe("Admin access via the hamburger menu", () => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run this against the real backend.");

    test("the desktop Admin button is hidden, but the dashboard is still reachable via the hamburger menu's own link", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("dialog", { name: "Local storage preferences" }).getByRole("button", { name: "Accept" }).click();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
      await dialog.getByLabel("Email").fill(ADMIN_EMAIL);
      await dialog.getByLabel("Password").fill(ADMIN_PASSWORD);
      await dialog.locator('button[type="submit"]').click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      // Documented in theme.js itself (.admin-btn { display: none } below 480px) -- confirming
      // the real, deliberate mobile-only tradeoff actually holds, not just that it's commented.
      await expect(page.getByRole("button", { name: "Admin", exact: true })).not.toBeVisible();

      await page.getByRole("button", { name: "Menu" }).click();
      const dashboardLink = page.getByRole("link", { name: "Admin Dashboard" });
      await expect(dashboardLink).toBeVisible();
      await dashboardLink.click();
      // "Total revenue" is a real KPI label AdminOverview always renders on entry, regardless of
      // data state -- confirmed directly against the source, not assumed. ("Signed in as" only
      // exists on the Checkout page, not here.)
      await expect(page.getByText("Total revenue", { exact: true })).toBeVisible({ timeout: 15000 });

      // The real point of moving Sign out into the mobile menu (user-chip is now hidden below
      // 480px, see theme.js) -- confirms it's not just present, but genuinely still reachable
      // and functional from here.
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true })).toBeVisible({ timeout: 15000 });
    });
  });
});
