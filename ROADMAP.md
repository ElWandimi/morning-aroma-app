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
      **Blocked on:** a real Paystack account (business details + bank account for payouts — the
      project owner needs to create this; can't be done by Claude). Once the account exists:
      checkout flow wired to Paystack's Inline JS or Checkout, webhook handling for order
      confirmation, real order records tied to real payment status.

## Tier 1.5 — Admin user management (found while wiring the frontend, not originally listed)

Doesn't block a customer signing up and buying something for real, but does block admin actually
managing real customers — right now Admin > Customers shows fake demo accounts, not real ones.

- [ ] `GET /users` (admin-only, JWT-protected) — list real registered users
- [ ] `PATCH /users/:id` (admin-only) — change role/permissions on a real account
- [ ] Wire `AdminCustomers` to these instead of the in-memory `users` list currently in
      `AuthProvider`

## Tier 2 — Needed alongside Tier 1 for a real backend

- [ ] **Real database** — Postgres. Same Prisma schema as the auth work above covers this; not a
      separate task, just the natural extension once auth is live (orders, products, etc. move
      from the frontend's in-memory state to real tables).
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
