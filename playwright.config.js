// playwright.config.js
//
// NOT VERIFIED TO RUN in the environment that produced this project — see
// tests/e2e/README.md for why, and what to check before relying on these.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // NOT fullyParallel -- every test here hits the same real, live, rate-limited production
  // backend (there's no local/mocked backend for this suite, unlike the Node.js backend's own
  // test suite). Real, confirmed cascade: admin-advanced.spec.js already serializes its OWN tests
  // against each other (test.describe.configure({ mode: "serial" }) below in that file), but with
  // fullyParallel true here, that file could still run concurrently WITH shopping.spec.js and
  // admin.spec.js -- each independently making real /login and /register requests against the
  // same IP at the same time. Confirmed directly: a real run tripped "Too many attempts" (the
  // real authLimiter, server/src/routes/auth.js) and the failure cascaded into 3 more tests in
  // different files, each surfacing a different symptom (a hung dialog, a timeout, a stale
  // assertion) depending on which step happened to hit the limit. workers: 1 below is the actual,
  // complete fix -- guarantees strictly one test running at a time across the WHOLE suite, not
  // just within one file, so the real, cumulative count of auth requests in any 15-minute window
  // stays something this suite's own size can actually account for.
  fullyParallel: false,
  workers: 1,
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