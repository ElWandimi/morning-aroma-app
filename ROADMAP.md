# Morning Aroma — Roadmap

This file is the source of truth for what's done, in progress, and remaining. It lives in the
repo (not just chat history) specifically so it survives across sessions — check this file first
before assuming what state the project is in.

**Goal, as of the last check-in with the project owner: launch for real, sooner than later.**
That decision governs the ordering below — Tier 1 comes before everything else, even though
Tier 3 items are individually easier to build.

---

## Tier 1 — Blocks real launch (in progress)

Nothing else matters for going live until these are real, not simulated.

- [x] **Auth backend** — real password hashing, sessions/JWT, server-side validation.
      **Status: deployed, live, and now wired to the frontend.** `server/` is running as its own
      Railway service (`upbeat-rebirth-production.up.railway.app`), connected to a real Postgres
      database, migration applied, `/health` confirmed responding.
      - [x] Schema for real use — built with raw SQL + `pg` instead of Prisma (see
            `server/README.md` for why: Prisma's client needs a binary this dev environment
            couldn't download; the original `prisma/schema.prisma` at repo root stays as the full
            data-model reference for what's still ahead)
      - [x] POST /auth/register (bcrypt password hashing) — plus first-user-becomes-admin
            bootstrap logic, since a real database starts genuinely empty, unlike the old seeded
            in-memory demo
      - [x] POST /auth/login (issues a JWT)
      - [x] GET /auth/me (JWT-protected, returns current user)
      - [x] POST /auth/logout
      - [x] Password reset flow (request + confirm) — token logic fully built and tested; still
            logs the token to the server console instead of emailing it, since no email provider
            is connected yet (see Tier 2)
      - [x] Deploy: Postgres provisioned on Railway, migration run, env vars set, live and
            responding at /health
      - [x] Frontend wired to the real backend: register/login/session-persistence/logout in
            `AuthProvider` now call the real API (`src/utils/api.js`); the login modal has a real
            Sign in / Create account toggle. **Requires `VITE_API_URL` set on the frontend's
            Railway service** — see deployment notes.
      - [x] **Found via a real user report, fixed:** "Forgot password" was still entirely fake for
            real accounts — it ran through the old local OTP system, never touching the real
            `/auth/password-reset/*` endpoints that had existed since the very first backend
            round. A real user who forgot their password had no actual way to recover their
            account. Rewired to the real endpoints; honest interim UX since no email provider is
            connected yet (the reset is genuinely real server-side, but the code must be relayed
            manually for now). Also made "Continue with Google" unmistakably a preview — it
            previously showed a picker of fake accounts styled exactly like a real Google login.
      - [ ] **New, split out as its own item (Tier 1.5 below):** admin user-management API. The
            Customers section's user list and role/permission management still operate on demo,
            in-memory-only data — a real registered customer will not show up there. OTP login,
            "Continue with Google", and 2FA also remain demo-only, each blocked on its own
            separate piece (real email delivery; a Google Cloud OAuth app; 2FA design work).
      - [ ] **Requirement captured for when Google OAuth is real** (project owner's request):
            registering via email+password must NOT create a duplicate account if that email
            already has an account via Google, and vice versa — one email should always resolve
            to one account regardless of which method was used to sign in. Not implemented yet
            because "Continue with Google" is still fake/local-only right now and doesn't share
            any storage with the real email+password accounts, so there's no actual collision to
            prevent yet — building linking logic against a placeholder that's getting replaced
            wouldn't be real work. Implement this as part of the real Google OAuth integration
            itself: on Google sign-in, check for an existing user by email first before creating
            a new one (and the reverse: /auth/register should recognize an email that already
            exists via Google, once that's a real possibility).
- [ ] **Payments** — Paystack integration (decided by the project owner — a strong fit given the
      business is Kenya-based; Paystack has real M-Pesa support there, which Stripe doesn't).
      Real Paystack account now exists, charging in KES.
      - [x] `POST /orders/:id/verify-payment` — never trusts a client-reported success; always
            re-confirms with Paystack's real Verify Transaction API using the secret key. Checks
            transaction status, currency (must be KES), and amount within a 5% tolerance of the
            order's USD total converted at a live exchange rate (an exact match would be wrong —
            rates genuinely drift between order and payment; the tolerance catches real tampering
            without false-rejecting normal drift). Database-level unique constraint on the
            Paystack reference (`server/migrations/003_paystack.sql`), not just an app-level
            check, so the same payment can never settle two different orders even under a race.
            13 new tests, 78/78 passing overall, using a dedicated Paystack mock since this dev
            environment can't reach api.paystack.co any more than it could reach Railway directly.
      - [x] Frontend wired. Checkout loads Paystack's real InlineJS (V2 — there's a real V1→V2
            API change, confirmed against current docs rather than assumed from training data)
            on demand, only once a customer reaches the payment step. The order is created once,
            on the first payment attempt, and reused across retries — so a cancelled or failed
            Paystack popup doesn't leave behind duplicate unpaid orders for the same cart. Amount
            charged is computed from the same live USD→KES rate `CurrencyProvider` already uses
            for display, so what Paystack actually charges matches what the customer saw on
            screen. **Not deployed yet** — needs `VITE_PAYSTACK_PUBLIC_KEY` set on the frontend's
            Railway service and `PAYSTACK_SECRET_KEY` set on the backend's, plus migration
            `003_paystack.sql` run against the live database, none of which have happened yet.
      - [ ] Webhook handling for payment confirmation (a second, more reliable confirmation path
            alongside the frontend-triggered verify call — Paystack recommends webhooks as the
            primary source of truth, since they fire even if the customer closes the tab right
            after paying).

## Tier 1.5 — Admin user management (found while wiring the frontend, not originally listed)

**Status: done.** Admin > Customers, Overview, and Analytics all show real registered customers now.

- [x] `GET /users` (admin-only, JWT-protected) — list real registered users. Enforced by a
      dedicated `requireAdmin` middleware that re-queries the current role from the database on
      every request, rather than trusting the JWT's embedded role (which can be stale until next
      login) — access revocation takes effect immediately, not whenever the person happens to log
      in again.
- [x] `PATCH /users/:id` (admin-only) — change role/permissions on a real account. Validates role
      and permission values against real allow-lists (not just "is it a string"), and refuses to
      demote the last remaining super_admin — without that check it'd be possible to lock every
      admin out of the dashboard with no way back short of a direct database edit.
- [x] Wired `AdminCustomers`, `AdminOverview`, and `AdminAnalytics` to a single centralized real
      users fetch in `AdminDataProvider` (`realUsers`/`realUsersLoading`/`realUsersError`/
      `refetchRealUsers`) rather than each section fetching independently — keeps the customer
      count, signup chart, and customer list from ever disagreeing with each other.
- [x] **Gap found while doing this, now fixed:** Settings > Backup (JSON export/import) still
      called `exportOrders()`/`restoreOrders()`, which stopped existing once orders also became
      real (see Tier 2 below) — a real crash waiting to happen the moment anyone clicked Download
      Backup. Fixed by removing those calls and correcting the confirm-dialog text. The backup
      still covers only what's genuinely in-memory now (catalog/admin overrides, the vestigial
      demo users list) — real customers and real orders both live in Postgres and aren't covered
      by this app-level backup at all, deliberately: a real database should have its own proper
      backup strategy (e.g. Railway's built-in database backups), not an ad-hoc JSON download.

## Tier 2 — Needed alongside Tier 1 for a real backend

- [x] **Real database, orders** — Postgres, `server/migrations/002_orders.sql`. `POST /orders`,
      `GET /orders/mine`, `GET /orders` (admin), `PATCH /orders/:id/status` (admin),
      `POST /orders/:id/cancel` (customer, Processing-only, matching the existing frontend
      restriction). Orders now genuinely persist — survive a refresh, admin can see them, a
      customer's order history is really theirs. **Frontend wired.** Checkout creates a real
      order, capturing each item's actual price at order time (not the old in-memory version's
      effective "whatever the product costs whenever you look" behavior). Journey shows real
      order history with real cancel. Admin Orders/Invoices/Overview/Analytics/Customers all read
      from one centralized real fetch (`realOrders` in `AdminDataProvider`, same pattern as
      `realUsers`) rather than each section risking a different view of the same data.
      21 backend tests from building the API, 66/66 passing overall — no new backend tests needed
      for the frontend wiring itself, since the endpoints were already covered.
- [ ] **Real database, products/pricing** — still frontend static data, not in Postgres. This is
      what blocks real price integrity on orders (see the limitation noted below) and would also
      need to happen before Products/Inventory admin edits could persist for real.
- [ ] **Order total price integrity** — `POST /orders` recomputes the total from submitted
      per-item prices (blocking the obvious tamper of a mismatched total), but those per-item
      prices still come from the client, not a verified catalog, since products/pricing aren't in
      this database yet. Depends on the item above.
- [ ] **Real email delivery** — order confirmations, the notification preference toggles (already
      built, currently honest no-ops). Needs an email provider decision (Resend / Postmark /
      SendGrid) — small decision, can wait until auth is further along.
      **Already built and staged, ready to connect the moment a provider is chosen:** welcome
      email and password reset email content both live in `server/src/utils/email.js`, with real
      subject lines and copy, wired into the register and password-reset-request endpoints as
      fire-and-forget calls. Right now they log to the server console outside production instead
      of actually sending — the one line that needs to change once a provider exists is inside
      that file's `logInDevOnly` function, not anywhere in routes/.
- [ ] **Real file storage** for admin product photo uploads (S3 / Cloudinary). Currently base64
      data URLs in memory — fine for the prototype, won't scale once there's a real backend.
- [ ] **Server-side rendering or pre-rendering** — for true per-page social cards/structured data
      reaching crawlers that don't execute JS. Lower priority than the above; current setup already
      works for Google's crawler.

## Tier 3 — Real features, buildable without a backend (paused, not blocked)

These don't need the backend and could be picked up any time, but are intentionally paused while
Tier 1 is in progress, per the stated "launch sooner than later" priority.

- [ ] Expand the Playwright test suite to cover everything built after the original two test files
      (green coffee, admin CRUD, staff permissions, invoicing, notifications, backup/restore)
- [ ] Subscriptions / recurring orders (FAQ already says "coming soon")
- [ ] Click-outside dismiss audit across every overlay (search modal, cart/wishlist drawers, login
      modal) — currency/language dropdowns already have this done properly; confirm the rest match
- [ ] Focus trapping inside modals (Tab shouldn't escape to the page behind them)
- [ ] ARIA live regions for toast notifications, so screen readers announce them
- [ ] Further code-splitting pass now that the codebase has grown past the last audit

## Tier 4 — Content and business expansion

- [ ] More products beyond the current 9 origins
- [ ] Real localized content (currently machine-translated via Google Translate, not real copy)
- [ ] Expand History timeline, Source Library, more Brew Guides

---

## Change log (most recent first)

- **Fixed a real, serious bug found via a user report: "Forgot password" was completely fake for
  real accounts.** It ran through the old local OTP system entirely, never touching the real
  backend endpoints built much earlier — meaning a real registered user who forgot their password
  had genuinely no way to recover their account. Rewired to the real backend (request/confirm),
  with an honest interim UX given no email provider is connected yet: the reset is real
  server-side, but the code has to be relayed manually for now rather than emailed automatically.
  Also made the still-fake "Continue with Google" preview unmistakable — it previously showed a
  picker of fake accounts styled exactly like a real Google login, with zero indication anywhere
  that it wasn't real. Both gaps were found by testing actual user reports rather than assuming
  the earlier auth-wiring work was complete.
- **Checkout wired to real Paystack.** The fake card-details form is gone, replaced with a real
  "Pay with Paystack" flow — creates the order once (reused across retries, so a cancelled popup
  doesn't leave behind duplicate unpaid orders), loads Paystack's script on demand only at the
  payment step, converts to KES using the same live rate already shown for display, and verifies
  with the real backend endpoint from the previous round. Not deployed yet — real keys and the
  new migration still need to be set up on Railway.
- **Real Paystack account created — payment verification backend built.** Researched the current
  API directly rather than from memory (there's a real V1→V2 InlineJS change that would have
  produced subtly wrong code otherwise). Built and tested the server-side verification endpoint:
  never trusts a client-reported success, always re-confirms with Paystack directly, tolerance-
  based amount checking to handle genuine exchange-rate drift without either false-rejecting
  normal cases or accepting real tampering, and a database-level (not just app-level) guarantee
  against the same payment reference settling two different orders. Found and fixed two real bugs
  in the test harness itself while building this, not just in the feature code. Frontend not wired
  yet — same backend-first split as auth and orders before it.
- **Checkout, Journey, and every admin order view now wired to the real backend.** Placing an
  order, viewing order history, cancelling, and every admin order/invoice/revenue view all use
  real data now — nothing left creating or reading fake in-memory orders. Caught and fixed a real
  bug while doing this: AdminAnalytics' revenue-by-date chart had the exact same bare-date-string
  bug already found and fixed for signups last round, in a second spot that round hadn't touched.
  Also found and fixed a real crash risk in Settings > Backup — it still called functions that no
  longer exist after this rewrite (exportOrders/restoreOrders), which would have thrown the
  moment anyone clicked Download Backup.
- **Real order persistence (backend only).** Orders now survive a refresh and live in Postgres —
  a genuine, honest improvement even though products/pricing aren't in this database yet, so
  order totals aren't fully price-verified server-side (documented clearly, not hidden). Chose
  this over starting speculative Paystack integration code, since no Paystack account exists yet
  and untested payment-API code carries real risk; this is foundational infrastructure payment
  integration will need regardless, and — unlike calling a real payment provider — fully testable
  right now the same way everything else has been. Not wired to the frontend yet, same
  backend-first/frontend-second split as auth. 21 new backend tests, 66/66 passing overall.
- **Tier 1.5 complete — admin user management is real.** GET/PATCH /users, admin-only, enforced
  server-side with a role check that re-queries current state rather than trusting a possibly-
  stale JWT. Refuses to demote the last admin. Admin Customers/Overview/Analytics all read from
  one centralized real fetch now instead of each showing potentially different data. Found and
  fixed a real bug this surfaced: the signups-by-date chart assumed a bare YYYY-MM-DD date
  string, which the real backend's full ISO timestamp would have silently broken (every signup
  landing in its own bucket instead of grouping by day). New known gap documented, not fixed:
  Settings > Backup still covers only the still-fake parts of the app (products, orders) — real
  customer data has no app-level backup and shouldn't, since a real database needs a real backup
  strategy, not a JSON download.
- **Welcome email content built and staged** (real subject/copy, fires on registration) —
  can't actually send yet, no provider connected, but genuinely ready to the moment one is.
  Password-reset email content moved into the same module for consistency. Confirmed the very
  first successful admin login worked end to end in production; fixed a real crash
  (React error #310 — a conditional hook call in AdminDashboard) hit on that first real login.
  Captured the project owner's requirement that one email should resolve to one account
  regardless of Google vs. password sign-in, attached to the real Google OAuth work it depends on
  rather than built against the current placeholder.
- **Frontend wired to the real auth backend.** Real register/login/session-persistence/logout.
  Login modal redesigned with a real Sign in / Create account toggle. Fixed the "demo admin" hint
  and OTP mode's copy, both of which would have been actively misleading after this change.
  Discovered and scoped a new gap while doing this: admin user management (Customers section)
  still needs its own backend work — split out as Tier 1.5. Payments decision noted: Paystack,
  not Stripe (project owner's call, better fit for a Kenya-based business) — updated across
  ROADMAP/SECURITY/README/.env.example rather than leaving stale references.
- **Auth backend deployed and live** — Postgres provisioned on Railway, migration applied, server
  running as its own service, `/health` responding. Frontend not wired to it yet.
- Created this roadmap. Built and tested the Tier 1 auth backend (register/login/me/logout/
  password-reset), 25/25 tests passing against a local test harness.
- Fixed Shop product-grid loading skeleton (revisited an earlier deferral).
- Fixed Shop filters dominating the mobile screen — collapsed into a drawer below 800px, found
  from a real device screenshot.
- Squashed 66 commits of frontend build history into one clean commit (`059bcd0`) before the
  first public push.

For the full detailed history of everything built before the squash (every admin section, every
bug fix, every audit — 66 commits' worth), see the conversation history; the squashed commit
message summarizes the complete feature set but the granular story lives in chat, not git, past
that point.
