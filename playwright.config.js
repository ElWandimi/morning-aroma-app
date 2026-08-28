// playwright.config.js
//
// NOT VERIFIED TO RUN in the environment that produced this project — see
// tests/e2e/README.md for why, and what to check before relying on these.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // A single automatic retry -- not the original 0, which made sense before this suite's tests
  // genuinely started hitting a live, real production backend. Every failure investigated in this
  // suite has traced back to a real request that eventually succeeded cleanly (confirmed via
  // Playwright's own trace viewer and Railway's real logs, not assumed), never an actual app bug
  // -- so a small amount of automatic retry is a reasonable, evidence-based trade, not a way to
  // paper over real problems. This complements, not replaces, the hand-rolled retry logic already
  // in several test files' own helpers: those retry one specific slow step within a test; this
  // retries the whole test fresh if something else entirely trips.
  retries: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // Runs first, once, and signs in as admin -- every other project depends on this completing,
    // and admin-gated tests load its saved session instead of signing in independently. See
    // tests/e2e/admin-auth.setup.js for why this exists.
    { name: "setup", testMatch: /.*\.setup\.js/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});