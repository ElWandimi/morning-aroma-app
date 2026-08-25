# E2E Tests (Playwright)

## Status: written and structurally validated, not executed against a real browser

These tests are written against the app's real UI structure (button text, labels, form
fields, CSS classes) as it exists in the actual source — verified directly against each file,
not guessed. Writing `shopping.spec.js` originally caught a real bug (the checkout form's labels
weren't programmatically associated with their inputs), which got fixed in the app itself, not
worked around in the test.

That said: **the environment that produced this project could not execute these tests.**
Playwright needs to download real browser binaries from `cdn.playwright.dev`, and this
environment's network access doesn't allow that host (same restriction as npm/pip package
registries being allowed but arbitrary CDNs not). `npx playwright test --list` — which only
parses and discovers tests, no real browser needed — was used to confirm every file here is at
least structurally valid and free of syntax errors, but nobody has actually watched these pass.
**Please run them yourself before trusting them in CI.**

A real, related fix while doing this round: `shopping.spec.js`'s checkout test had gone stale
along with the app itself — it referenced a fake card-entry form ("Name on card," "Card number,"
"Place Order (demo)") that was completely replaced with real Paystack integration in an earlier
round. That test now correctly stops at confirming the real "Pay with Paystack" step is reached
and its button is enabled, rather than attempting to automate Paystack's own external popup UI —
deliberately, since that would need real network access to Paystack's script CDN this
environment has no guarantee of, real test-mode payment credentials, and would really be testing
Paystack's UI stability rather than this app's own code.

## Running them

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
npx playwright test
```

The config (`playwright.config.js`) automatically starts the dev server for you
(`npm run dev` on port 5173), so you don't need to start it separately first.

## Real admin tests need real credentials

`admin.spec.js`'s `Admin dashboard` tests sign in against the real, deployed backend (auth has
been real for a long time — see `ROADMAP.md`), so they need a real `super_admin` account's
credentials. **Never hardcoded here** — provided locally by whoever runs them:

```bash
PLAYWRIGHT_ADMIN_EMAIL=you@example.com PLAYWRIGHT_ADMIN_PASSWORD=yourrealpassword npx playwright test
```

Without these set, that specific `describe` block is skipped (not failed), so the rest of the
suite still runs cleanly. The `Non-admin access is genuinely blocked` test in the same file needs
no special credentials at all — it registers its own, fresh customer account (never admin by
default) and runs unconditionally.

## What's covered

- `homepage.spec.js` — homepage loads, nav links reach Shop/Moments/Academy
- `shopping.spec.js` — the Aroma Quiz produces a matched result; adding an item opens the
  cart drawer; a full guest → sign-in → shipping → the real Paystack payment step checkout flow
- `admin.spec.js`:
  - **No credentials needed**: a freshly-registered customer account genuinely can't reach the
    admin dashboard — confirmed against the real, actual guard in `admin/index.jsx`
    (`if (!user || role isn't super_admin/staff) show a locked screen`), not just that the nav
    link is hidden (a hidden link alone isn't a real security boundary).
  - **Needs real admin credentials**: signing in as super admin reaches the dashboard; adding a
    product and editing its price via Admin genuinely reflects on the real, public Shop page —
    the single most explicitly-flagged gap from this file's own previous version, and a direct
    regression test for the exact "resets on refresh"/"doesn't actually persist" bug class this
    project hit repeatedly (products, green beans, settings) before each was made real.

## What's not covered (worth adding next)

- Green coffee (wholesale) admin CRUD, staff permission grants/revocations, invoicing, admin
  notifications, Settings backup/restore — all real now, none covered by a dedicated test yet
- The OTP sign-in path's own behavior specifically (code expiry, resend) — currently only
  exercised incidentally, as a means to get signed in for the checkout test, not tested in its
  own right
- Mobile viewport behavior (the nav collapses to a hamburger menu below 900px — these tests
  run at desktop width)
- Visual regression testing of the photography/animation work
- Real Cloudinary photo upload flow through the admin UI
