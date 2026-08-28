import { test as setup } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth", "admin.json");

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

// This is now the ONLY real admin sign-in the whole suite performs -- every admin-gated test
// across every file reuses this one saved session (via test.use({ storageState: authFile }))
// instead of independently signing in fresh. This is the actual, real fix for the rate-limiting
// confirmed via Railway's own logs (genuine 429s on /auth/login and /auth/register): the previous
// design had every single admin-gated test re-authenticate from scratch, multiplying real
// /auth/login requests across a 19-test run into well more than the real 20-per-15-minutes limit.
// This doesn't touch that limit at all -- it's a real, working security feature -- it just makes
// the test suite request auth the same modest number of times a real, single user actually would.
setup("authenticate as admin once for the whole suite", async ({ page }) => {
  setup.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run admin-gated tests.");

  // Retries up to 3 times, with a real pause between attempts -- same reasoning as the rest of
  // this suite's hardening: genuine backend latency (or, now directly confirmed, a real rate
  // limit still cooling down from an earlier run) can make a single sign-in attempt fail even
  // though the app itself is correct.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/");
    const consentBanner = page.getByRole("dialog", { name: "Local storage preferences" });
    if (await consentBanner.isVisible().catch(() => false)) {
      await consentBanner.getByRole("button", { name: "Accept" }).click();
    }
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
    await dialog.getByLabel("Email").fill(ADMIN_EMAIL);
    await dialog.getByLabel("Password").fill(ADMIN_PASSWORD);
    await dialog.locator('button[type="submit"]').click();
    const signedIn = await dialog.waitFor({ state: "hidden", timeout: 25000 }).then(() => true).catch(() => false);
    if (signedIn) break;
    if (attempt === 3) throw new Error("admin-auth setup: could not sign in after 3 attempts.");
    await page.waitForTimeout(3000);
  }

  await page.context().storageState({ path: authFile });
});
