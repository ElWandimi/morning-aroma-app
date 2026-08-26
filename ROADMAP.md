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
      - [x] **Admin user-management API — done, see Tier 1.5 below.**
      - [x] **Real OTP (email-code) login, done.** `server/migrations/009_login_codes.sql` +
            `server/src/utils/otp.js` + two real endpoints (`/auth/otp/request`, `/verify`) — a
            dedicated `login_codes` table, deliberately separate from `users` (a code can be
            requested for an email with no account yet; this is passwordless login and signup
            combined, same principle as Google sign-in). Real 6-digit codes via
            `crypto.randomInt` (not `Math.random()`, which the old fake simulation used only
            because it never mattered locally), sha256-hashed at rest, genuinely expire after 10
            minutes, and a real 3-attempt lockout enforced server-side — mirroring what the old
            frontend only ever simulated in state that meant nothing. Serves as both login and
            registration, and respects 2FA the same way password and Google sign-in do. Frontend
            fully wired — the "Email code" tab no longer generates and displays a code to itself;
            it sends a real email and verifies a real response, with the backend's real errors
            (wrong code, expired, locked out) surfaced directly. 252/252 backend tests. Confirmed
            for real, not just by the test suite: requested a code with a real inbox, received a
            real email with a real 6-digit code (at the time, landed in Gmail's Updates tab rather
            than Primary, tied to the missing-verified-domain limitation now resolved — see the
            domain section below), entered it, and signed in successfully.
      - [x] **Real 2FA (TOTP), done.** `server/migrations/008_two_factor.sql` +
            `server/src/utils/twoFactor.js` (otplib + qrcode) + four real endpoints
            (`/auth/2fa/setup`, `/verify-setup`, `/verify-login`, `/disable`). Real QR-code setup
            with a manual-entry fallback, 8 one-time hashed backup codes shown exactly once, login
            genuinely gated behind a second factor for any account with it enabled. A real security
            bug was caught and fixed while building this, not just a design nicety: the short-lived
            "pending 2FA" token was signed with the same secret as a real session token, and
            `requireAuth` never checked *which kind* it was — it would have granted full API access
            without the second factor ever actually being confirmed. Fixed by rejecting any token
            carrying a `type` claim. Frontend fully wired (real QR display, real code entry, real
            backup-codes-shown-once, disable requires password re-confirmation). 220/220 backend
            tests on its own, 235/235 once Google sign-in's own tests were added alongside it, then
            252/252 with OTP login's tests on top. Manually confirmed end to end in a real browser:
            enabled, signed out, signed back in and was actually prompted for a code, disabled
            again.
      - [x] **Real Google sign-in, done — including the account-linking requirement the project
            owner asked for.** `server/src/routes/auth.js`'s `/auth/google` verifies a real
            Google-issued ID token (`google-auth-library`) that Google's own real Identity Services
            "Sign in with Google" button produces client-side — no authorization code, no client
            secret, no redirect flow, so no `GOOGLE_CLIENT_SECRET` is even needed. Serves as both
            login and registration: a matching email signs into the existing account regardless of
            which method created it, a new email creates one — one email always resolves to one
            account, now actually implemented and tested, not just captured as a future TODO.
            Respects 2FA the same way password login does. Confirmed for real, not just by the
            test suite: signed in with a real Google account, received Google's own official "you
            used Sign in with Google" confirmation email, and the app showed the correct signed-in
            state afterward.
- [x] **Payments** — Paystack integration (decided by the project owner — a strong fit given the
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
            screen. **Deployed and confirmed working end to end** — `VITE_PAYSTACK_PUBLIC_KEY` set
            on the frontend, `PAYSTACK_SECRET_KEY` on the backend, migration `003_paystack.sql`
            run against the live database, and a real test-mode payment completed and verified
            against both the live Paystack dashboard and Admin Orders' payment status column.
      - [x] **Webhook handling for payment confirmation.** A second, more reliable confirmation
            path alongside the frontend-triggered verify call — fires from Paystack's own servers
            regardless of whether the customer's browser is even still open, unlike the frontend
            call which depends on the JS actually running after the popup closes. Researched
            Paystack's real webhook docs directly before building (a critical, easy-to-miss detail
            confirmed there: the signature is HMAC-SHA512 over the *raw* request body — if
            Express's JSON middleware parses it first, re-serializing for the signature check
            won't byte-for-byte match what Paystack actually signed, silently breaking
            verification for every genuine webhook). Refactored the existing verify-payment
            endpoint's logic into a shared function (`server/src/utils/paymentVerification.js`) so
            the frontend-triggered path and the webhook can never quietly drift apart on what
            counts as genuinely paid. 11 new tests covering signature verification (missing,
            wrong, and — the case that actually proves the check is real — a valid signature
            computed over a *different* body than what's sent), event-type filtering, and the key
            scenario this feature exists for: an order marked paid through the webhook alone, with
            no frontend verify-payment call involved at all, simulating a customer closing the tab
            right after paying. 97/97 backend tests passing.
            **Requires a manual dashboard step, not an environment variable:** the webhook URL
            (`<backend-url>/webhooks/paystack`) needs to be registered in Paystack's dashboard
            (Settings → API Keys & Webhooks) before Paystack will ever actually call it — not done
            yet as of this writing.
      - [x] **Real stock decrement, a real cancellation window, and a real refund workflow.**
            Found from a direct user report right after live payments started working: stock
            never actually decremented on a real sale. Stock now decrements on genuine payment
            confirmation (not order creation), clamped at zero. A paid order can only be
            self-cancelled within 10 minutes of payment (an explicit design decision, not
            assumed); cancelling one restores stock, marks the order `refund_pending`, and emails
            every `super_admin`. A new admin-only endpoint (`POST /orders/:id/refund`) then calls
            Paystack's real Refund API — a deliberate, admin-triggered action per a direct
            decision against full automation, not a background process. Found and fixed a real
            bug in the SQLite test adapter itself while building this (silently misaligned
            parameters when a query legitimately reused the same one twice). 17 new tests,
            145/145 backend tests passing.

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
- [x] **Real database, products — backend and frontend both done.** Found via a real user
      report after going live with real payments: an admin price edit would show immediately, then
      silently revert on refresh, because `AdminDataProvider`'s price/tier/stock/photo overrides
      were always just `useState({})` — plain React memory, never persisted anywhere. Real fix,
      not a patch: `server/migrations/005_products.sql` (real `products` table), seeded with the 9
      original products generated *programmatically* from the actual frontend source
      (`server/scripts/generate-product-seed.mjs`) rather than hand-retyped — directly tested the
      SQL-escaping logic on a deliberate apostrophe case, not just trusted it worked because the
      current data happened not to need it. `GET /products` (public — customers browse without
      signing in), `POST /products` (admin, generates the id as a slug matching the frontend's own
      `slugify` exactly, since real orders/cart/wishlist already reference products by this id),
      `PATCH /products/:id` (admin, partial updates — just a price, just a photo), `DELETE
      /products/:id` (admin, soft-delete, matching the existing "discontinued item" behavior a
      real past order needs). 21 new backend tests, 121/121 passing.
      **Frontend wired.** `AdminDataProvider`'s entire product system now calls the real API
      instead of client-side-only overrides — `getPrice`/`getTier`/`getAllProducts` read the real
      fetched catalog, `setPrice`/`setTier`/`setStock`/`setProductPhoto`/`addProduct`/
      `removeProduct` are real, async API calls with proper loading/error handling in Admin
      Products and Inventory. Fetched unconditionally on app load for every visitor (not gated
      behind admin/staff role the way `realUsers`/`realOrders` are), since Shop and product
      browsing are core public functionality, not an admin concern.
      Found and fixed two real regressions while wiring this, before they shipped: (1)
      `getStock`/`setStock` are shared between retail products and green beans (a separate,
      still-fake wholesale system) — the first pass would have silently broken green bean stock
      updates entirely by routing everything through the real products API; fixed by having
      `setStock` correctly dispatch between the two based on which list an id actually belongs to,
      and restoring a dedicated `greenStockOverrides` state that had been accidentally deleted
      along with the retail-only overrides. (2) `getProductPhotoUrl`'s fallback logic depended on
      an `isCustom` flag that no longer exists on real backend products — left as-is, any newly
      admin-added product without an uploaded photo would have shown a broken image; fixed with an
      explicit list of the 9 products that genuinely have bundled photo files.
      Also found and fixed a real UX bug, not just cosmetic: `ProductPage` would briefly show a
      false "We couldn't find that variety" message for a real, existing product during the
      instant before the catalog finishes its first fetch — a customer visiting a direct product
      link would see the page claim the product doesn't exist, then have it correct itself. Fixed
      with an explicit loading state distinguishing "still loading" from "genuinely not found."
      Settings > Backup fixed (would have crashed referencing the removed override state) and
      extended to cover the restored green-stock state.
      Green coffee (wholesale) products were deliberately out of scope for this round — see the
      dedicated item below, which closes that same gap.
- [x] **Real database, green coffee (wholesale) — the same migration applied to the parallel
      system deliberately left untouched above.** Not yet reported as a bug, but a known instance
      of the exact same problem: `customGreenBeans`, `greenPriceOverrides`, `greenStockOverrides`,
      `removedGreenBeanIds` were all client-side-only state, same as retail products before their
      fix. `server/migrations/006_green_beans.sql` — real `green_beans` table, seeded with the 9
      original lots generated programmatically (`server/scripts/generate-green-bean-seed.mjs`),
      same discipline as products. `roastedId` links a lot to its corresponding retail roast as a
      real, enforced foreign key into `products`. Full CRUD, same shape as `/products`
      (`GET` public, `POST`/`PATCH`/`DELETE` admin-only), with cross-field validation (minimum
      order can't exceed stock) checked against real current state on a partial update, not just
      the fields in that specific request. 17 new backend tests, 163/163 passing.
      **Frontend wired**, `getStock`/`setStock` simplified to dispatch between two fully real APIs
      now that neither needs a client-side fallback. Found and fixed a genuinely more severe bug
      than anything in the products round: the Green Coffee page's initial state assumed a
      selected lot always exists (`useState(selected.minOrderKg)`) — during the brief window
      before the real catalog's first fetch completed, this would throw an actual runtime
      exception, not just show a stale value, crashing the whole page rather than degrading
      gracefully. Also depended on the old static import's first id for its initial selection,
      with no real guarantee that id still existed in the actual fetched data. Both fixed with
      safe defaults and an explicit loading/error/empty guard, checked directly against the real
      component rather than assumed safe by analogy to the products fix.
- [x] **Real business settings — found from a direct user report, the same "resets on refresh"
      bug already fixed for products and green beans.** `server/migrations/007_settings.sql` — a
      genuine single-row table (`CHECK (id = 1)`), JSONB blob for the ~13 fields themselves, seeded
      from `DEFAULT_SETTINGS` (newly extracted from inline React state into `src/data/index.js`
      specifically so the migration's seed data can be generated from the real source rather than
      hand-copied). `GET /settings` public, `PATCH /settings` admin-only with a real partial merge
      matching the existing frontend contract, rejecting any key that was never a real setting.
      Both fall back to sensible defaults if the row doesn't exist yet, rather than silently
      returning an empty object that would leave the announcement banner and contact info blank on
      a live, unmigrated deployment.
      Found and fixed a second, related bug in the same area: Settings backup/restore would have
      silently written a restored file's settings into local-only state without ever saving them
      to the real backend — looking like it worked, then quietly reverting on the next refresh,
      the identical bug class reachable through a different path.
      Found a real structural risk while wiring the frontend, not assumed safe by analogy to
      earlier rounds: naively initializing the edit form's draft state directly from
      `useState(settings)` could capture a stale fallback value if the Settings page were opened
      before the real fetch completed, and would never update even once the real data arrived
      (`useState`'s initial value is never re-evaluated after the first render). Fixed by
      splitting into an outer loading-gate component and an inner form component, so the form's
      state only ever mounts once loading is genuinely done.
      12 new backend tests, specifically exercising the merge-and-persist upsert pattern (`INSERT
      ... ON CONFLICT DO UPDATE`, not used anywhere else in this codebase before now), including
      confirming a second save doesn't wipe what an earlier one wrote. 189/189 backend tests
      passing.
- [x] **Order total price integrity.** `POST /orders` now looks up each item's real, current
      price from the `products` table and uses that for the actual total — the client-submitted
      `unitPriceCents` is still validated for shape (backward-compatible with the existing
      frontend contract) but is genuinely ignored for pricing. An order referencing a product that
      doesn't exist, or one discontinued since, is rejected outright (400) rather than silently
      accepted. Standard `IN (...)` with individually numbered placeholders rather than Postgres's
      `ANY($1)` array syntax, keeping this portable across the real backend and the SQLite test
      harness without new adapter-specific translation.
      7 new/updated tests, including deliberately submitting a wrong client-side price and
      confirming the real total is used anyway, not the submitted one — and correctly recalculated
      three existing downstream tests (webhook confirmation, live-vs-test payment mode detection)
      whose Paystack mock amounts depended on the old, no-longer-trusted client prices. Seeded via
      the real `POST /products` endpoint rather than a parallel test-only mechanism, which also
      incidentally re-confirms the id-generation logic (`slugify(name-country)`) produces exactly
      the ids the rest of the suite already expected. 128/128 backend tests passing.
- [x] **Real email delivery — provider decided and integrated: Resend.** Welcome emails and
      password reset emails both send for real once `RESEND_API_KEY` is set (see
      `server/.env.example`). Built with a graceful dev-mode fallback (logs instead of sending
      when unconfigured) so local development and the test suite never require a real account.
      8 new backend tests specifically for the configured/sending path (not just re-running the
      existing dev-fallback tests) — verifying real params reach the provider, errors are
      surfaced correctly, and registration itself never fails just because email sending did
      (fire-and-forget, confirmed with a simulated provider outage). 86/86 backend tests passing.
      Found and fixed two real bugs while building this: the email content hardcoded links to
      `morningaroma.com`, a domain the project owner doesn't actually own (now uses the real
      deployed `FRONTEND_URL` instead); and the auth rate limiter's real 20-requests/15-min limit
      (correct for production) was too strict for a thorough test suite's own request volume,
      raised specifically in test mode rather than weakened for production.
      **Previously a real remaining limitation, now resolved:** Resend requires a verified domain
      to deliver to arbitrary customers — without one, only Resend's shared `onboarding@resend.dev`
      sender worked, and even that could only reach the Resend account's own registered email, not
      real customers. The project owner has now purchased and verified a real domain
      (`morning-aroma.com`, via Cloudflare) — see the domain section further down for the full
      detail. `EMAIL_FROM_ADDRESS` is now `Morning Aroma <hello@morning-aroma.com>` on Railway, and
      a real email to an address genuinely different from the Resend account's own registered one
      was confirmed delivered.
      Order confirmations and the notification preference toggles could reuse this same real
      sending infrastructure once written — not yet built, but no longer blocked on anything.
- [x] **Real domain purchased and fully wired in — `morning-aroma.com`, via Cloudflare.** Two
      genuinely separate things, both done:
      1. **Email domain verified with Resend** — DKIM, SPF, and DMARC all show verified in
         Resend's dashboard (auto-configured directly against Cloudflare via Resend's own
         integration, not manually copy-pasted). `EMAIL_FROM_ADDRESS` set to
         `Morning Aroma <hello@morning-aroma.com>` on Railway. Confirmed for real: a login code
         sent to an email address genuinely different from the Resend account's own registered
         one was delivered successfully — the exact restriction this was blocked on before.
      2. **The site itself now serves from the real domain** — added as a custom domain on
         Railway's frontend service (same port, 8080, as the existing default domain), verified
         live at `https://morning-aroma.com`. `FRONTEND_URL` updated on the backend to match
         (this is what CORS and email links both read from — no code change needed, just the env
         var), and the Google OAuth Client's Authorized JavaScript origins updated to include the
         new domain alongside the existing localhost/railway.app entries. Confirmed for real:
         signed in directly on `https://morning-aroma.com` itself (not localhost), proving CORS,
         the custom domain, and the Google origin whitelist are all genuinely connected, not just
         configured.
      **Found and fixed while cleaning up, not left as a loose end:** every remaining reference to
      the old placeholder domain from before one was owned — `morningaroma.com` (no hyphen, never
      real) instead of the actual `morning-aroma.com`. Three `index.html` social-share meta tags
      (`og:image`, `og:url`, `twitter:image`) were pointing at a domain that never existed, which
      meant link previews on WhatsApp/Twitter/etc. were silently broken this whole time — the
      referenced `og-image.jpg` genuinely exists in `public/`, so this is a real, visible fix, not
      cosmetic. `robots.txt`'s `Sitemap:` line and all 20 URLs in `sitemap.xml` updated too (the
      sitemap previously pointed at the working `railway.app` URL, not the placeholder — functional
      before, but now correctly canonical). Two `contactEmail` fallback defaults
      (`src/data/index.js`, `server/src/routes/settings.js`) corrected to the real, deliverable
      address — checked directly against the live Settings page afterward too, in case the old
      placeholder had already been saved to the real database rather than just sitting in a
      fallback default.
- [x] **Real file storage for admin product photo uploads — Cloudinary, real account.** Real
      upload via `src/utils/cloudinary.js` on both product create and update, replacing base64
      stored directly in the database. The existing client-side resize-then-base64-encode flow
      needed no changes — only what the backend does with that string did. A `photoUrl` that's
      already a real URL (unchanged from a previous save) passes through untouched, avoiding a
      pointless re-upload every time an unrelated field gets edited.
      Found and fixed two real, separate bugs while building this: (1) `POST /products` accepted
      `photoUrl` in the request body but never actually included it in the `INSERT` — a photo
      uploaded while creating a brand-new product was silently dropped every time, not merely
      stored as base64 instead of a real URL. (2) Express's JSON body size limit was left at its
      100kb default — a normally-sized resized product photo (client-side capped at 700px wide,
      JPEG quality 0.85) can still realistically exceed that once base64-encoded, and would have
      been silently rejected with a 413 before ever reaching a route handler, regardless of where
      the URL ends up stored. Raised to 5mb. 13 new backend tests, including one specifically
      using a ~150kb payload (comfortably past the old limit) to prove the size-limit fix actually
      works, not just assumed from the code change. 176/176 backend tests passing.
- [x] **Real path-based routing + per-page meta tag injection for crawlers.** The project owner
      confirmed switching from hash routing (`#/shop`) to real paths (`/shop`) — a real,
      deliberate decision, not a default: a browser never sends the part of a URL after `#` in an
      HTTP request at all, so no amount of server-side code could ever have made hash routing work
      for crawlers, meaning this was genuinely blocked without it.
      **Routing itself**: `parsePath`/`buildPath` (now exported as `pathFor`) replace the old
      hash-based versions; `go()` uses `window.history.pushState` instead of setting
      `location.hash`, and a `popstate` listener replaces the old `hashchange` one. Only three
      places in the whole codebase touched `window.location.hash` directly, all found and fixed.
      **A real production server was required, not optional**: confirmed directly (not assumed)
      that Railway doesn't serve SPAs correctly without one — without an explicit fallback to
      `index.html` for paths Vite didn't build a real file for, every direct link or page refresh
      on any non-home route would 404, since hash routing never needed this (every request was
      always just for `/`). `server.cjs` (a new file, `npm start` runs it) handles this, plus
      real per-page meta tag injection for crawlers that don't execute JS — the actual point of
      this whole change — by extracting the same `PAGE_META` table and per-product logic the
      client already uses (via a build step, `scripts/generate-route-meta.mjs`) into a form the
      server can read, so the two can't silently drift apart. Verified with real, live HTTP
      requests against a running server (health check, home, a static page, a real dynamic
      product page, the SPA fallback on multiple routes, an unknown path, a real static asset) —
      not just read from the code.
      Found and fixed two real bugs while building the server itself: `package.json`'s
      `"type": "module"` broke `require()` in a plain `.js` file, fixed by naming it `.cjs`
      explicitly; and Express 5 no longer accepts the bare `"*"` wildcard route syntax (a real
      breaking change from Express 4) — fixed with a path-less `app.use()`, discovered by
      actually running the server rather than trusting the code would work as written.
      **Found and fixed while checking the rest of the codebase systematically, not assumed
      unaffected**: ~18 internal navigation links used `href="#"` with a click handler — works
      fine for users, but invisible to any crawler parsing raw HTML rather than executing JS,
      undermining the actual point of this change. All fixed to carry a real `pathFor()` href.
      Three hardcoded links to `www.morningaroma.com` — a domain the project owner doesn't own,
      confirmed earlier this session — in Organization/Product structured data and transactional
      emails; fixed to use the real, current origin instead. A genuinely broken PDF invoice
      footer, unrelated to routing but found in the same pass: it hardcoded a non-functional
      `hello@morningaroma.com` instead of using the business's real, already-configured contact
      email, even though that setting already existed and was already threaded through everywhere
      else in the same object. And a password reset email that referenced a `/reset-password`
      page that was never real, even before this change — the actual reset flow is a manually-
      entered code in a modal reached from the homepage, not a dedicated page; rewrote the email
      to describe the real flow honestly instead of implying a broken magic link.
      **Requires a real deployment change, not just code**: Railway needs to be told to run
      `npm start` (which now runs `server.cjs`) instead of whatever default static-file serving
      it's been doing — a manual step in Railway's settings, not something a patch alone can do.
      163/163 backend tests passing (backend touched only for the email content fix above).

## Tier 3 — Real features, buildable without a backend (paused, not blocked)

These don't need the backend and could be picked up any time, but are intentionally paused while
Tier 1 is in progress, per the stated "launch sooner than later" priority.

- [x] **Playwright test suite — actually run now, not just structurally validated, and 8/8 passing
      against the real deployed backend.** The "can't download browser binaries" limitation
      described below was specific to the sandbox that originally wrote these tests — running them
      for real, on the project owner's own machine, surfaced a long chain of genuinely real bugs
      that had gone undetected precisely because nobody had ever run this suite before:
      - Vite's dev-server file watcher was catching Playwright's own `test-results/` writes and
        triggering a full app reload mid-test, tearing down whatever element a test was mid-click
        on — fixed by excluding those directories from the watcher (`vite.config.js`).
      - `VITE_API_URL` was never set in local dev, so every API call was silently hitting the Vite
        dev server itself (which returned `index.html` disguised as a 200) instead of the real
        backend — the actual root cause behind most of what follows, not each item individually.
      - Every `.then(({ field }) => setState(field))` call in `AdminDataProvider`/`AuthProvider`
        would silently overwrite a safe initial value with `undefined` the moment a response came
        back malformed, crashing the app several renders later with no clue why — hardened with a
        shared `pluck()` helper that throws immediately into the caller's existing `.catch()`
        instead of destructuring blind.
      - A real race condition in the Aroma Quiz: it computed a match from the product catalog
        without ever checking whether that catalog had actually finished loading yet.
      - A real UX gap in guest checkout: a signed-out guest clicking "Checkout" landed on the
        Review step instead of skipping straight to Sign-in, contradicting both the test and the
        intended behavior.
      - The admin nav test waited for a link that only exists inside the collapsed mobile menu,
        instead of the button that's actually visible in the desktop nav.
      - Real IP-based currency auto-detection was overriding a hardcoded `"$22.00"` assertion —
        fixed by deliberately blocking the geo-lookup in that one test, relying on the app's own
        intentional USD fallback rather than fighting a real, working feature.
      - Playwright's default 5-second assertion timeout was too tight for genuine round-trips to
        the real backend (sign-in, registration, product creation) — raised to 15s on those
        specific assertions, not globally.
      **Still explicitly not covered**, tracked honestly rather than implied done: green coffee
      admin CRUD, staff permission grants specifically, invoicing, admin notifications, Settings
      backup/restore, the OTP flow's own behavior (now real, still untested by Playwright), mobile
      viewport, visual regression, and the real Cloudinary upload flow.
- [ ] Subscriptions / recurring orders (FAQ already says "coming soon")
- [x] **Click-outside dismiss audit — real gaps found, not just confirmed already-correct.**
      `LoginModal`, `SearchModal`, and the feedback/review modal all had click-outside-to-close
      completely missing (clicking the darkened backdrop did nothing). `CustomerCareWidget` — not
      even on this list originally — was found missing it too during the systematic check, and
      needed its outer JSX fragment converted to a real `<div>` first, since a fragment can't hold
      the `ref` `useClickOutside` needs. Confirmed the drawers (`CartDrawer`, `WishlistDrawer`)
      already had it correctly, via each drawer's own overlay `onClick` + inner `stopPropagation`
      — a different but equally valid pattern from the currency/language dropdowns' shared
      `useClickOutside` hook, left as-is rather than needlessly unified.
- [x] **Focus trapping inside modals.** New `useFocusTrap` hook (`src/hooks/index.js`) — keeps
      Tab/Shift+Tab cycling within a modal's own focusable elements while open, moves focus onto
      the container on open (without stealing it from a field that already has `autoFocus`, e.g.
      `SearchModal`'s input), and restores focus to whatever triggered the modal once it closes.
      Applied to every true modal and drawer (`LoginModal`, `SearchModal`, the feedback modal,
      `CartDrawer`, `WishlistDrawer`) — deliberately not `CustomerCareWidget`, which is
      `aria-modal="false"` on purpose (a non-blocking popover, not a true modal dialog).
      Found and fixed a real bug in the hook itself before it shipped: `ref.current.focus()`
      silently does nothing on a plain `<div>` without an explicit `tabIndex` — every container
      needed `tabIndex={-1}` added alongside the `ref` for this to actually work, not just look
      like it should.
- [x] **ARIA live regions for toast notifications.** Found the existing implementation was
      already substantially correct (`aria-live="polite"` was already present, and the container
      was already always-mounted rather than conditionally rendered, which is what actually
      matters for reliable announcements) — added `role="status"` alongside it, the more widely-
      recognized semantic pairing for this exact use case, as a low-risk reinforcement rather than
      a from-scratch fix.
- [ ] Further code-splitting pass now that the codebase has grown past the last audit

## Tier 4 — Content and business expansion

- [ ] More products beyond the current 9 origins
- [ ] Real localized content (currently machine-translated via Google Translate, not real copy)
- [ ] Expand History timeline, Source Library, more Brew Guides

---

## Change log (most recent first)

- **A real domain, purchased and fully wired in — `morning-aroma.com`.** Two genuinely separate
  pieces, both done and confirmed live, not just configured: real email delivery (Resend domain
  verification, `EMAIL_FROM_ADDRESS` updated, confirmed by sending to an address outside the
  Resend account itself — the exact restriction this was blocked on) and the actual site now
  serving from the real domain (Railway custom domain, `FRONTEND_URL` updated, Google OAuth's
  origins updated, confirmed by signing in directly on the real domain rather than localhost).
  Also found and fixed every remaining reference to the old placeholder domain from before one was
  owned — three broken social-share meta tags, the sitemap and robots.txt, and two contact-email
  defaults. See Tier 1 for full detail.
- **Real OTP (email-code) login, real 2FA, and real Google sign-in — all three now done — plus the
  Playwright suite actually run for the first time, surfacing and fixing a real chain of bugs
  along the way.** See Tier 1 for full detail on each auth method, and Tier 3 for the Playwright
  findings (a Vite dev-server reload loop, `VITE_API_URL` never being set locally, unguarded
  response destructuring that could crash the app renders later, a real quiz race condition, a
  real checkout UX gap, a stale admin nav locator, real currency auto-detection fighting a test
  assertion, and Playwright's default timeout being too tight for genuine backend round-trips). A
  real security bug was also caught while building 2FA: the short-lived pending-2FA token could
  have bypassed `requireAuth` entirely since nothing checked *which kind* of token it was. All
  three sign-in methods now share the same real 2FA gate and the same real account-resolution
  logic (one email, one account, regardless of which door someone signs in through). 252/252
  backend tests, 8/8 Playwright tests, all three auth methods confirmed manually end to end in a
  real browser against the real deployed backend — including a real email with a real code
  actually landing in a real inbox.
- **Playwright test suite expanded, and a real stale-test bug fixed along the way.**
  `shopping.spec.js`'s checkout test still referenced the old fake card-entry form fully replaced
  by real Paystack integration rounds ago — would have failed immediately if run. Fixed to stop
  at the real payment step rather than automating a third party's own popup UI. New
  `admin.spec.js`: a credential-free test confirming non-admin access is genuinely blocked
  (checked against the real guard in the source, not assumed), plus two admin-credential-gated
  tests including the most explicitly-flagged prior gap — a product price edit genuinely
  reflecting on the real Shop page. Found and fixed two real Playwright strict-mode ambiguity
  bugs while writing these. Honest about a real constraint: this sandbox can't download Playwright's
  browser binaries (confirmed directly), so every test here is structurally validated via
  `--list` but not actually run against a browser — the same limitation the original two test
  files already disclosed. Explicitly not everything from the original scope; tracked honestly.
- **Accessibility: click-outside audit, focus trapping, ARIA live regions for toasts.** Found 4
  real click-outside gaps (`LoginModal`, `SearchModal`, the feedback modal, and
  `CustomerCareWidget` — the last one not even on the original list, found by checking
  systematically rather than trusting the stated scope). Built a real, reusable `useFocusTrap`
  hook and applied it to every true modal/drawer, catching and fixing a real bug in the hook
  itself before it shipped (`.focus()` silently does nothing on a `<div>` without `tabIndex`).
  Toast notifications' `aria-live="polite"` was already substantially correct; added `role="status"`
  as a low-risk reinforcement. Also fixed two unrelated stale comments found while in these exact
  files (one still describing hash-based routing, one describing a two-step password reset flow
  that was simplified to one step in an earlier round). Frontend-only; 189/189 backend tests
  confirmed unaffected.
- **Real business settings — found from a direct user report: Admin Settings (announcements,
  contact info, tax/invoice details) reset on refresh, the exact same bug already fixed for
  products and green beans, just not yet reported here.** Real single-row `settings` table
  (JSONB, enforced by a `CHECK (id = 1)` constraint), seeded from a newly-extracted
  `DEFAULT_SETTINGS` constant (moved out of inline React state so it can't drift from what's
  actually seeded). Real partial-merge `PATCH`, matching the existing frontend contract. Found and
  fixed a second, related bug in the same area: Settings backup/restore would have silently
  written a restored file's settings into local-only state without saving them to the real
  backend — looking like it worked, then quietly reverting on the next refresh, the identical bug
  class reachable through a different path. Also found a real structural risk while wiring the
  frontend: naively initializing the edit form's draft state directly from `useState(settings)`
  could capture a stale fallback value if opened before the real fetch completed, silently never
  updating even once the real data arrived — fixed by splitting into an outer loading-gate
  component and an inner form component, so the form's state only ever mounts once loading is
  genuinely done. 12 new backend tests, specifically exercising the merge-and-persist upsert
  pattern (not used anywhere else in this codebase before now), including confirming a second save
  doesn't wipe what an earlier one wrote. 189/189 backend tests passing.
- **Real file storage: Cloudinary integrated for product photos.** Replaces base64-in-database
  with real uploads, no frontend changes needed — the existing resize-then-base64 flow was already
  the right shape, only what the backend does with it changed. Found and fixed two real,
  independent bugs while building this, neither specific to Cloudinary itself: `photoUrl` was
  silently dropped entirely on product creation (accepted in the request, never actually inserted
  into the database), and Express's 100kb default JSON body limit could silently reject a normal
  resized photo with a 413 before it ever reached a route handler. 13 new tests, including one
  using a realistically-sized (~150kb) payload specifically to prove the size-limit fix works, not
  just assumed. 176/176 backend tests passing.
- **Switched to real path-based routing, with real per-page meta tags for crawlers — a
  deliberate, confirmed decision given the real trade-offs involved, not a default.** Required a
  real production server (`server.cjs`, `npm start`), confirmed necessary by checking Railway's
  actual SPA-serving behavior directly rather than assumed. Found and fixed two real server bugs
  (a `"type": "module"` conflict, an Express 5 breaking change) by actually running the server
  against live HTTP requests, not just reading the code. Also found and fixed, while checking the
  rest of the codebase systematically: ~18 internal links that were invisible to crawlers despite
  working fine for users, three hardcoded links to a domain the project owner doesn't own, a
  genuinely broken PDF invoice email (unrelated to routing, found in the same pass), and a
  password-reset email describing a page that was never actually real. Requires a manual Railway
  deployment change (documented separately) — a patch alone can't do it. 163/163 backend tests
  passing.
- **Green coffee (wholesale) migrated to a real database — the same fix retail products got,
  applied proactively before it was ever reported as a bug.** Real `green_beans` table, seeded
  programmatically (same discipline as products), full CRUD, real foreign key linking a lot to its
  retail roast. 17 new backend tests, 163/163 passing. Found a genuinely more severe bug while
  wiring the frontend than anything in the products round: the Green Coffee page would throw an
  actual runtime exception (not just show a stale value) during the instant before its first real
  fetch completed, since its initial state assumed a selected lot always exists. Fixed with safe
  defaults and an explicit loading/empty guard. Also fixed a stale documentation section found
  while writing this up: `server/README.md` still described products as "not wired to frontend
  yet" despite that being done for several rounds.
- **Stock decrement, a real cancellation window, and a real refund workflow — three real gaps
  found from direct user reports, all closed together given how tightly they interact.**
  - **Stock now genuinely decrements** on real payment confirmation (not order creation, so an
    abandoned checkout never reduces real availability), clamped at zero.
  - **Cancellation window**: a paid order can only be self-cancelled within 10 minutes of payment
    (unpaid orders — no real money involved yet — can still be cancelled anytime). The frontend
    now hides the Cancel button once the window has passed, rather than letting a customer click
    something destined to fail.
  - **Real refund workflow**: cancelling a paid order restores stock, marks the order
    `refund_pending`, and emails every `super_admin` — refunds are a deliberate admin action, not
    automatic, per a direct decision on this. A new admin-only endpoint calls Paystack's real
    Refund API; Admin Orders' existing "Refund" button (which explicitly warned "no real payment
    is processed") now calls this for real instead.
  - Found and fixed a genuine bug in the test infrastructure itself while building this: the
    SQLite test adapter's `$N` → `?` translation didn't handle a query reusing the same parameter
    twice (`stock - $1 < 0 THEN 0 ELSE stock - $1`) — Postgres parameters are references and can
    repeat; SQLite's `?` placeholders are strictly positional. The query ran without error but
    silently misaligned values. Fixed the adapter itself, not just this one query, since any
    future query could hit the same issue.
  - 17 new backend tests covering all three features together (stock decrement, clamping at zero,
    the window both within and past its boundary, stock restoration, the admin notification email
    actually sending, the real refund endpoint succeeding, and — importantly — correctly *not*
    marking an order refunded when Paystack's own API fails). 145/145 backend tests passing.
- **Order total price integrity closed.** `POST /orders` now uses each item's real, current
  catalog price server-side, ignoring whatever the client submits — the last real gap in the
  payment chain now that real product data exists to check against. Rejects orders for products
  that don't exist or have been discontinued. 7 new/updated backend tests, including deliberately
  submitting a wrong price and confirming the server uses the real one instead, plus correctly
  recalculating three downstream payment tests whose expected amounts depended on the old,
  no-longer-trusted client prices. 128/128 backend tests passing.
- **Products frontend wiring complete — the bug that started this is actually fixed now.** Every
  admin catalog edit (price, tier, stock, photo, add, discontinue) is a real, persisted API call.
  Found and fixed two real regressions before they shipped: green bean stock updates would have
  silently broken (routed through the retail-only API by mistake), and newly admin-added products
  without a photo would have shown a broken image (a fallback that depended on a flag that no
  longer exists on real products). Also found and fixed a real UX bug: a direct product link could
  briefly show a false "not found" message before the catalog's first fetch completed. 121/121
  backend tests still passing (this round was frontend-only), full production build confirmed.
- **Real products backend built — found from a real bug report right after going live.** An admin
  price edit would show, then silently revert on refresh, because product/pricing data was never
  anything but client-side React memory. Real `products` table, seeded with the actual 9 original
  products generated programmatically from the frontend source (not hand-retyped — a real risk for
  9 complex nested records), full admin CRUD with public read access. 21 new tests, 121/121
  passing. Frontend not wired yet, on purpose — same backend-first split as orders and payments.
- **Payment mode tracking added, ahead of switching to live Paystack keys.** Without this, a real
  transaction and a test one would look identical in the orders table once both key types had
  ever been used — both just "paid," KES amount, no way to tell them apart. Every payment now
  records whether it went through a test or live key at the moment of verification, surfaced as a
  small badge in Admin Orders and included in the CSV export, since once real money is actually
  involved this distinction matters for real bookkeeping. 3 new tests, including confirming the
  detection genuinely distinguishes live from test rather than just defaulting to one value.
  100/100 backend tests passing.
- **Paystack webhook built — real payment confirmation no longer depends on the customer's browser
  staying open.** Researched the real webhook docs directly before building; found and correctly
  handled the single detail most implementations get wrong (signature verification needs the raw,
  unparsed request body — Express's normal JSON middleware would silently break it). Refactored
  the existing verify-payment logic into one shared function so the frontend-triggered path and
  the webhook can never drift apart on what "genuinely paid" means. 11 new tests, including
  proving the signature check is real (not just "a header was present") and the actual scenario
  this exists for: an order marked paid through the webhook alone, no frontend call involved.
  97/97 backend tests passing. Still needs the webhook URL registered in Paystack's dashboard — a
  manual step, not done yet. Also corrected two stale "not deployed yet" notes in the roadmap for
  Paystack itself, which has in fact been live and confirmed working for a few rounds now.
- **Real email delivery: Resend integrated.** Welcome and password-reset emails genuinely send
  once configured — researched Resend's current API and domain-verification requirements
  directly before building (confirmed a real, important constraint: arbitrary customer delivery
  needs a verified domain, which the project owner doesn't have yet — real remaining limitation,
  not more code needed). Found and fixed two real bugs while building this: hardcoded email links
  to a domain nobody owns, and a test-suite-only rate-limiting false failure that took real
  debugging (not guessing) to diagnose correctly. 86/86 backend tests passing.
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
