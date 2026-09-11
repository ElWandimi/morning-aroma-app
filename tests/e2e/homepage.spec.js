import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads and shows the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Find Your Morning Aroma" })).toBeVisible();
  });

  test("nav links reach their pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop" }).click();
    await expect(page.getByRole("heading", { name: "Shop All Coffee" })).toBeVisible();

    // "Moments" lives inside the collapsed "Explore" dropdown (see components/index.jsx --
    // exploreLinks), not as a direct top-level nav link -- this pre-existing test predates that
    // reorganization and never got updated to open the dropdown first, which is why it was
    // timing out waiting for a top-level link that no longer exists. Opens the trigger, then
    // clicks the real menuitem-role link inside the panel.
    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("menuitem", { name: "Moments" }).click();
    await expect(page.getByRole("heading", { name: "Coffee Moments" })).toBeVisible();

    // "Academy" also exists as a real link in the footer (contentinfo landmark), not just nav --
    // getByRole alone is ambiguous under strict mode. Scoped to the navigation landmark
    // specifically, the same disambiguation pattern mobile.spec.js already uses for its own
    // "Green Coffee" link (also duplicated in the footer).
    await page.getByRole("navigation").getByRole("link", { name: "Academy" }).click();
    await expect(page.getByRole("heading", { name: "Academy" })).toBeVisible();
  });
});

// Covers the reorganized homepage sections added in this round: the two-column hero split, the
// trust icon grid, the signature collection grid, the quality/commitment split, and the two
// feature tiles -- all reusing real existing content per the approved section mapping, nothing
// invented. Each assertion is checked directly against Home.jsx/theme.js as written, not guessed.
test.describe("Homepage — reorganized sections", () => {
  test("hero renders as a two-column split: product photo, headline, and both CTAs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();

    // The real bundled SL28 — Kenya product photo, not a placeholder -- confirms the hero
    // actually renders the chosen existing asset (/photos/products/sl28-kenya.png), not a
    // broken image or the old full-bleed-only layout.
    const productShot = page.getByRole("link", { name: "View SL28 — Kenya" });
    await expect(productShot).toBeVisible();
    await expect(productShot.locator("img")).toHaveAttribute("src", "/photos/products/sl28-kenya.png");

    await expect(page.getByRole("heading", { name: "Find Your Morning Aroma" })).toBeVisible();

    // Both real, pre-existing CTAs still present after the layout change -- unchanged copy,
    // just repositioned into the right column alongside the headline.
    await expect(page.getByRole("button", { name: "Take the Aroma Quiz" })).toBeVisible();
    // "Explore the Shop" appears twice on this page (hero + SignatureCollection's CTA bar
    // further down) -- .first() disambiguates to the hero's own instance specifically.
    await expect(page.getByRole("button", { name: "Explore the Shop" }).first()).toBeVisible();
  });

  test("clicking the hero product photo navigates to the real SL28 — Kenya product page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.getByRole("link", { name: "View SL28 — Kenya" }).click();
    await expect(page).toHaveURL(/\/product\/sl28-kenya/);
    // Real, previously-flaky assertion: while realProducts is still loading, ProductPage renders
    // only "Loading…" (see Shop.jsx's own early return) -- a fixed-name h1 only appears once that
    // resolves. Matching the exact "SL28 — Kenya" heading (not loose "Kenya" text, which timed out
    // waiting on the loading state) and giving it real backend round-trip time, the same 15s
    // budget admin.spec.js already uses for its own real-backend waits.
    await expect(page.getByRole("heading", { name: "SL28 — Kenya" })).toBeVisible({ timeout: 15000 });
  });

  test("trust icon grid shows the same four real facts as the trust bar, restyled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    // These four headings are TrustGrid's own titles -- deliberately the same underlying facts
    // TrustBar already stated elsewhere (free shipping, Paystack, small-batch, traceable), not
    // new claims invented for this denser layout.
    for (const title of ["Free Shipping", "Secure Checkout", "Small-Batch Roasted", "Traceable Origin"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("signature collection grid renders real catalog products with working Add-to-cart", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    await page.route("https://ipapi.co/**", (route) => route.abort());

    // SignatureCollection returns null entirely (not a loading placeholder) while realProducts
    // is still loading from the real backend -- same real async gap as ProductPage's own
    // "Loading…" state, just with nothing rendered instead of that text. Same 15s real-backend
    // budget as the product-page heading assertion above, rather than the default 5s.
    await expect(page.getByRole("heading", { name: "Our Signature Coffee Collection" })).toBeVisible({ timeout: 15000 });
    // At least one real product card and cart action -- not asserting an exact count, since the
    // grid reads live from the admin-editable catalog (getAllProducts()) and can genuinely grow
    // or shrink over time without this test needing to change.
    const addButtons = page.getByRole("button", { name: /add/i });
    await expect(addButtons.first()).toBeVisible();
    await addButtons.first().click();
    // Real cart behavior (CartProvider opens the drawer on add), confirming this grid's Add
    // button is genuinely wired to the same cart logic as the rest of the site, not a dead
    // decorative button left over from the restyle.
    await expect(page.getByRole("button", { name: "Checkout", exact: true })).toBeVisible();
  });

  test("quality split and feature tiles reuse real existing copy and link to real pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();

    // Same three facts SourceTrust already states elsewhere on this page -- confirms the split
    // section didn't invent new sourcing claims, just repositioned the existing ones. Scoped to
    // .quality-split specifically, since "Every bag names its farm." genuinely appears twice on
    // this page (here, and again in the real SourceTrust section further down) -- a real,
    // deliberate content duplication per the approved mapping, not a bug to work around.
    const qualitySplit = page.locator(".quality-split");
    await expect(qualitySplit.getByText("Sourced With Care, Roasted With Precision")).toBeVisible();
    await expect(qualitySplit.getByText("Every bag names its farm.")).toBeVisible();

    // FeatureTiles links to the two real existing pages by their own accessible names (set via
    // aria-label, since each tile's visible text also includes a heading and blurb that would
    // otherwise make the link's computed name ambiguous).
    await page.getByRole("link", { name: "Visit the Academy" }).click();
    await expect(page).toHaveURL(/\/academy/);
    await expect(page.getByRole("heading", { name: "Academy" })).toBeVisible();

    await page.goBack();
    await page.getByRole("link", { name: "See Our Services" }).click();
    await expect(page).toHaveURL(/\/services/);
    await expect(page.getByRole("heading", { name: "Our Services" })).toBeVisible();
  });

  test("no unwanted horizontal overflow from the new sections at desktop width", async ({ page }) => {
    // The new grids (signature-grid, trust-grid, feature-tiles) all use CSS Grid with
    // auto-fit/minmax, the same pattern as the site's existing grids -- confirms that pattern
    // held here too and nothing pushes the page wider than the viewport.
    await page.goto("/");
    await page.getByRole("dialog", { name: "Local storage and error monitoring preferences" }).getByRole("button", { name: "Accept" }).click();
    const overflowsHorizontally = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowsHorizontally).toBe(false);
  });
});
