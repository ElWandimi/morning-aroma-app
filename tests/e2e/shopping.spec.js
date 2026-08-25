import { test, expect } from "@playwright/test";

test.describe("Aroma Quiz", () => {
  test("answering all 4 questions produces a matched variety", async ({ page }) => {
    await page.goto("/");
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
    await page.getByRole("link", { name: "Shop" }).click();
    await expect(page.getByRole("heading", { name: "Shop All Coffee" })).toBeVisible();

    const firstAddToCart = page.getByRole("button", { name: "Add to cart" }).first();
    await firstAddToCart.click();

    // Cart drawer should open automatically on add.
    await expect(page.getByText("Your bag")).toBeVisible();
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("guest checkout is gated behind sign-in, reaches the real Paystack payment step", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop" }).click();
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await page.getByRole("button", { name: "Checkout" }).click();

    // Not signed in yet — should land on the sign-in step, cart preserved.
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in / Create account" }).click();

    // Use the email-code preview mode rather than email & password -- that mode is now backed by
    // the real deployed backend (see ROADMAP.md), which this test environment has no guarantee of
    // being configured to reach, and there's no pre-seeded account to sign into anymore now that
    // auth is real. The preview mode needs neither: it's self-contained in the browser, and this
    // test's actual purpose is just to be signed in for the checkout flow below, not to test
    // admin-specific behavior.
    await page.getByRole("button", { name: "Email code (preview)" }).click();
    await page.getByPlaceholder("you@example.com").first().fill(`e2e-test-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send me a code" }).click();
    const code = await page.locator(".otp-demo-code strong").innerText();
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Verify & sign in" }).click();

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
    // control. This is the same reasoning already applied to why this test uses the OTP preview
    // mode above rather than the real backend-connected sign-in path.
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
    await expect(page.getByText("Pay securely with Paystack")).toBeVisible();
    const payButton = page.getByRole("button", { name: "Pay with Paystack" });
    await expect(payButton).toBeVisible();
    await expect(payButton).toBeEnabled();
  });
});
