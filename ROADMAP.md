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

- [ ] **Auth backend** — real password hashing, sessions/JWT, server-side validation.
      **Status: starting now.** Building as `/server`, a separate Node/Express service in this
      same repo, deployed as a second Railway service alongside the existing frontend one.
      - [ ] Prisma schema adapted for real use (already had a reference version at
            `prisma/schema.prisma` at repo root — moving/adapting into `/server/prisma/`)
      - [ ] POST /auth/register (bcrypt password hashing)
      - [ ] POST /auth/login (issues a JWT)
      - [ ] GET /auth/me (JWT-protected, returns current user)
      - [ ] POST /auth/logout
      - [ ] Password reset flow (request + confirm) — needs a decision on email provider before
            this can send a real email; can build the token logic now and stub the "send" step
      - [ ] Wire the existing frontend login modal to call these real endpoints instead of the
            in-memory demo logic
      - [ ] Deploy: provision Postgres on Railway, set env vars, push
- [ ] **Payments** — Stripe integration. **Blocked on:** a real Stripe account (business details +
      bank account for payouts — the project owner needs to create this; can't be done by Claude).
      Once the account exists: checkout flow wired to Stripe Checkout or Elements, webhook handling
      for order confirmation, real order records tied to real payment status.

## Tier 2 — Needed alongside Tier 1 for a real backend

- [ ] **Real database** — Postgres. Same Prisma schema as the auth work above covers this; not a
      separate task, just the natural extension once auth is live (orders, products, etc. move
      from the frontend's in-memory state to real tables).
- [ ] **Real email delivery** — order confirmations, password reset emails, the notification
      preference toggles (already built, currently honest no-ops). Needs an email provider decision
      (Resend / Postmark / SendGrid) — small decision, can wait until auth is further along.
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

- **[this session]** Created this roadmap. Starting Tier 1 auth backend.
- Fixed Shop product-grid loading skeleton (revisited an earlier deferral).
- Fixed Shop filters dominating the mobile screen — collapsed into a drawer below 800px, found
  from a real device screenshot.
- Squashed 66 commits of frontend build history into one clean commit (`059bcd0`) before the
  first public push.

For the full detailed history of everything built before the squash (every admin section, every
bug fix, every audit — 66 commits' worth), see the conversation history; the squashed commit
message summarizes the complete feature set but the granular story lives in chat, not git, past
that point.
