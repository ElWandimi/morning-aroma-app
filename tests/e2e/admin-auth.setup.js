import { test as setup } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { submitWithRateLimitBackoff } from "./rate-limit-helper.js";

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
  // submitWithRateLimitBackoff's own real worst case is ~255s (3 attempts, 25s timeout each, 90s
  // waits between) -- 300s gives that a real margin rather than cutting it close. Everything else
  // depends on this step succeeding first, so its failure cascades into every other test never
  // running at all, not just this one failing on its own -- worth a genuinely generous budget.
  setup.setTimeout(300000);

  // A single attempt, not the previous 3x-with-3s-pause outer loop -- submitWithRateLimitBackoff
  // (see that file's own comment) already retries internally, up to 3 times with a real 90s wait
  // between attempts specifically for a genuine rate limit, and its own 25s timeout already covers
  // ordinary transient backend latency. Wrapping that in another retry loop here would nest two
  // separate retry strategies (worst case, several real minutes of waiting) and, worse, be
  // counterproductive: retrying more within an already-active rate-limit window just keeps
  // counting against it rather than actually waiting it out.
  await page.goto("/");
  const consentBanner = page.getByRole("dialog", { name: "Local storage, error monitoring, and analytics preferences" });
  if (await consentBanner.isVisible().catch(() => false)) {
    await consentBanner.getByRole("button", { name: "Accept" }).click();
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to Morning Aroma" });
  await dialog.getByLabel("Email").fill(ADMIN_EMAIL);
  await dialog.getByLabel("Password").fill(ADMIN_PASSWORD);
  await submitWithRateLimitBackoff(page, dialog, dialog, "hidden");

  await page.context().storageState({ path: authFile });
});
