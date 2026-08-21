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

    await page.getByRole("link", { name: "Moments" }).click();
    await expect(page.getByRole("heading", { name: "Coffee Moments" })).toBeVisible();

    await page.getByRole("link", { name: "Academy" }).click();
    await expect(page.getByRole("heading", { name: "Academy" })).toBeVisible();
  });
});
