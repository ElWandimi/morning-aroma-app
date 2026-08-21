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

  test("guest checkout is gated behind sign-in, then reaches confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop" }).click();
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await page.getByRole("button", { name: "Checkout" }).click();

    // Not signed in yet — should land on the sign-in step, cart preserved.
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in / Create account" }).click();

    // Sign in with the demo admin account. Email code is the default tab now (it's the real
    // sign-up path for a new customer); switch to the password tab for the demo admin login.
    await page.getByRole("button", { name: "Email & password (demo)" }).click();
    await page.getByPlaceholder("you@example.com").first().fill("elwandimi@gmail.com");
    await page.getByPlaceholder("••••••••").fill("Kenya1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("button", { name: "Continue to shipping" }).click();
    await page.getByLabel("Full name").fill("Test Customer");
    await page.getByLabel("Address").fill("123 Coffee Street");
    await page.getByLabel("City").fill("Nairobi");
    await page.getByLabel("Country").fill("Kenya");
    await page.getByRole("button", { name: "Continue to payment" }).click();

    await page.getByLabel("Name on card").fill("Test Customer");
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry").fill("12/30");
    await page.getByLabel("CVC").fill("123");
    await page.getByRole("button", { name: "Place Order (demo)" }).click();

    await expect(page.getByText("order confirmed")).toBeVisible();
    await expect(page.getByText(/is roasting soon/)).toBeVisible();
  });
});
