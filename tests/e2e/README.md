# E2E Tests (Playwright)

## Status: written, not verified to run

These tests are written against the app's real UI structure (button text, labels, form
fields) as it exists in `src/App.jsx` — they aren't guesses. Writing `shopping.spec.js` even
caught a real bug (the checkout form's labels weren't programmatically associated with their
inputs), which got fixed in the app itself, not worked around in the test.

That said: **the environment that produced this project could not execute these tests.**
Playwright needs to download browser binaries from a CDN, and that environment's network
access was restricted to package registries (npm) only — no route to Playwright's binary
CDN. So while the test logic is sound and matches the real DOM structure, nobody has actually
watched these pass. Please run them yourself before trusting them in CI.

## Running them

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
npx playwright test
```

The config (`playwright.config.js`) automatically starts the dev server for you
(`npm run dev` on port 5173), so you don't need to start it separately first.

## What's covered

- `homepage.spec.js` — homepage loads, nav links reach Shop/Moments/Academy
- `shopping.spec.js` — the Aroma Quiz produces a matched result; adding an item opens the
  cart drawer; a full guest → sign-in → shipping → payment → confirmation checkout flow

## What's not covered (worth adding next)

- Admin Dashboard flows (sign in as super admin, edit a price, confirm it reflects on the
  shop page)
- The OTP sign-in path (code generation, expiry, resend)
- Mobile viewport behavior (the nav collapses to a hamburger menu below 900px — these tests
  run at desktop width)
- Visual regression testing of the new photography/animation work
