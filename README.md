# Morning Aroma — Frontend Prototype

An interactive, click-through prototype of the Morning Aroma coffee brand site, built with React + Vite.
This is a **frontend-only prototype**: all data (products, journal entries, orders, accounts, admin edits)
lives in memory and resets on page refresh. There is no real backend, database, or payment processing —
see [What's real vs. mocked](#whats-real-vs-mocked) and [`SECURITY.md`](./SECURITY.md) for the full picture.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually **http://localhost:5173**).

Other commands:

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Demo login

Use the built-in demo super admin to explore the signed-in and admin experience:

- **Email:** `elwandimi@gmail.com`
- **Password:** `Kenya1234`

Once signed in, an **Admin** button appears in the nav. You can also try the mock **email code**
sign-in (a 6-digit code is shown on-screen, since no real email can send from a prototype) or the mock
**Google** account picker — selecting `elwandimi@gmail.com` there signs into the *same* account rather
than creating a duplicate, demonstrating the "unified account" behavior from the original brief.

## Pages included

- Homepage — hero (with Ken Burns background), Premium/Rare tier, Aroma Quiz teaser, Everyday tier, Moments, trust block, live "Auction Beat" banner
- Shop — full catalog with filters (aroma, body, acidity, roast, moment, brew method)
- Product pages — sensory profile bars, growing tab, brew/course tab
- Coffee Moments — hub + 4 landing pages (each with its own photography) with mini brew guides
- Brew Guides — hub + 6 method pages
- Academy — hub + course pages (11 Beverage Craft courses + Home Brewing, Sensory & Cupping, and Professional tracks), each beverage course with a **downloadable PDF recipe card**
- Growing Library — by Variety / Country / Growing Factor, plus a Soil Explorer
- Coffee Seasons & Auctions — global harvest calendar + country pages
- The Bean's Journey — parallax scroll history with an animated timeline bean
- Our Promise — full-bleed photo hero, vision/mission, clickable core values
- Aroma Quiz — 4-question quiz that recommends a variety
- Global Rituals, FAQ, Contact, Source Library (origin map, processing methods, published FOB pricing)
- Privacy Policy and Terms of Service, linked in the footer
- The World Journey — all 8 origin countries with history, photography, and the varieties grown there
- Our Services — remote roasting/brewing consulting and Kenyan coffee auction representation, with an inquiry form
- Wishlist (guest-friendly, persists across sessions) and quick search (typo-tolerant) from the nav
- Real translation via the actual Google Translate Website widget — a 🌐 language picker in the
  nav (12 curated languages), plus an auto-suggest banner based on the visitor's detected country
  (free IP geolocation lookup, with graceful fallback to browser language if that lookup fails)
- Real multi-currency: prices detected in the visitor's local currency (via IP geolocation) and
  converted at live exchange rates, with a manual 💱 currency picker in the nav (13 curated
  currencies). Admin dashboard figures and the Source Library's published FOB pricing
  intentionally stay in USD — the store's ledger currency and the real-world convention for
  quoting international coffee trade prices, respectively
- My Aroma Journey — journal with a flavor-fingerprint radar chart, personalized recommendations, order history with reorder, and a two-factor authentication toggle
- Cart → full checkout flow (review → sign-in → shipping → payment → confirmation)
- "Leave Your Aroma" feedback overlay — 5-bean rating, sliders, descriptor tags
- Customer care widget — WhatsApp, phone, email, and a real **live chat** with contextual auto-replies, all admin-configurable
- Sign-in includes a working (mocked) **forgot password** flow — email code verification, then set a new password
- **Admin Dashboard** (super admin only) — see below

## Admin Dashboard

Sign in as the demo super admin and click **Admin** in the nav. Twelve sections, all backed by real
(in-memory) state — changes here are reflected live across the storefront, not just within the
dashboard itself:

| Section | What it does |
|---|---|
| Overview | Revenue, order count, customer count, open quotations, unreviewed feedback, avg. rating, top products by units sold |
| Orders | Every order across every customer, with a live status dropdown |
| Customers | Every registered account, with a Make Admin / Revoke Admin toggle |
| Products | Full catalog with inline **live price and stock editors** — edits instantly reflect in the shop, product pages, cart, and checkout |
| Content | Edit any Moment's description, Course's blurb, or Country's World Journey history — live on the storefront |
| Quotations | Every B2B request submitted through the footer form, with a status pipeline (New/Contacted/Closed) |
| Service Inquiries | Requests from the Our Services page (consulting / Kenyan auction representation), with its own status pipeline |
| Live Chat | Full transcripts of every live chat conversation started from the customer care widget, with status tracking |
| Feedback | Every review submitted through "Leave Your Aroma", with a Reviewed checkbox |
| Live Messages | Edit Kenya's rotating "Auction Beat" banner messages, live on the homepage and Kenya's country page |
| Audit Log | Every price, stock, content, and settings change, with who made it and when |
| Settings | Site tagline, contact email, WhatsApp/phone numbers, and a site-wide announcement bar |

**Important:** this access control is enforced client-side only, which is appropriate for a prototype
but is **not real security** — see [`SECURITY.md`](./SECURITY.md) for what a production deployment
needs on top of this before it protects anything real.

## What's real vs. mocked

| Area | This prototype | A production build |
|---|---|---|
| Data | In-memory JS state, resets on refresh | PostgreSQL (see `prisma/schema.prisma` for the full reference; `server/migrations/` has what's actually live so far — just the `users` table) |
| Auth | Client-side mock (no real email/Google) | **Real backend deployed** (`server/` — bcrypt, JWT, password reset), live on Railway. Frontend not wired to it yet — see `ROADMAP.md`. OTP and Google OAuth still need email delivery / a Google Cloud OAuth app respectively, neither connected yet |
| Admin access | Client-side role check only | Server-side authorization on every request |
| Payment | UI only — **nothing is charged or stored** | Paystack (per the project owner's decision — strong fit for a Kenya-based business, real M-Pesa support) |
| Content (History, Academy, etc.) | Hardcoded in `src/App.jsx`, editable via Admin → Content for Moments/Courses | Headless CMS (Strapi/Sanity) |
| Recipe cards | Generated client-side as real PDFs (via `jspdf`) | Same approach works in production, or server-rendered |
| Images | Real photography (Unsplash, hotlinked) | Same, ideally served via Cloudinary/S3 for control and optimization |

## Security

This prototype has meaningful hardening for what it actually does (input length limits, no
`dangerouslySetInnerHTML`, no `eval`, correct autocomplete attributes, no secrets in the codebase) —
but it is still a frontend-only demo. **Read [`SECURITY.md`](./SECURITY.md) before treating any part
of this as production-ready**, especially the Admin Dashboard's access control.

## Environment variables

None are required to run this prototype — it's genuinely `npm install && npm run dev` with no setup.
[`.env.example`](./.env.example) documents the original hypothetical full-backend plan; the real
backend that actually exists lives in `server/`, is simpler than that plan, and has its own
[`server/.env.example`](./server/.env.example) — see [`ROADMAP.md`](./ROADMAP.md) for what's
actually built versus still ahead.

## Data model

[`prisma/schema.prisma`](./prisma/schema.prisma) models the entities this prototype already uses
(Products, Orders, Users, Journal entries, Feedback, Quotations, Courses, Moments, Countries, Live
Messages, Site Settings) as a real Prisma schema — not wired to a live database, but ready to be, so a
backend team isn't designing the data model from scratch and reconciling it with the UI afterward.

## Project structure

```
├── index.html
├── package.json
├── vite.config.js
├── .env.example          # env vars a real backend would need
├── SECURITY.md           # what's hardened today vs. what production needs
├── prisma/
│   └── schema.prisma     # reference data model
├── public/                # sitemap.xml, robots.txt, manifest.json, icon.svg —
│                           # copied as-is into the build output by Vite
├── scripts/
│   └── generate-sitemap.mjs  # regenerates public/sitemap.xml from real routing data
├── tests/e2e/            # Playwright tests (see tests/e2e/README.md)
├── .github/workflows/    # CI: builds on every push/PR
└── src/
    ├── main.jsx          # React entry point
    ├── App.jsx           # AppShell + App — routes pages, wires up providers
    ├── data/              # all static content: products, moments, courses,
    │                      # countries, history, FAQ, etc. — pure data, no logic
    ├── utils/
    │   ├── helpers.js     # storage, fmtPrice, slugify, fuzzy search, etc.
    │   └── pdf.js         # recipe card PDF generation (lazy-loaded)
    ├── hooks/              # useFonts, useScrollReveal, useEscapeKey, useDocumentMeta
    ├── context/            # every provider: Auth, Cart, Wishlist, Admin,
    │                       # Orders, Journal, Toast, Route
    ├── components/         # shared UI: Nav, Footer, modals, drawers, widgets
    ├── admin/              # the full Admin Dashboard (12 sections)
    ├── pages/              # one file per page area (Shop, Growing, Journey,
    │                       # Checkout, Services, World Journey, etc.)
    └── styles/
        └── theme.js        # the design system as a single exported CSS string
```

This wasn't the original structure — through phase 8 of this build, everything lived in one
`src/App.jsx` file that grew to roughly 5,500 lines. That was a deliberate early tradeoff (easy to
read top-to-bottom, easy to hand off as a single reference file), but past a certain size it becomes
a real cost: harder to navigate, and a much worse foundation for a team to build on. It was split into
the module structure above using a proper AST-based extraction (Babel's parser/traverse, not
regex) — every one of the 138 original top-level declarations was verified to land in its new file
byte-for-byte identical to the original source, and the production build's output hash is unchanged
from before the split. Nothing about *what* the app does changed, only how the code is organized.

## Routing & SEO

Every page has a real, bookmarkable URL — `/shop`, `/product/geisha-panama`, and so on — enabling
deep-linking and a working browser back/forward button.

**Real path-based routing (`/shop`), not hash routing (`#/shop`) — a deliberate decision.**
Earlier versions of this project used hash routing specifically so `dist/index.html` could be
opened directly via `file://` with zero server configuration. That trade-off was consciously
given up: hash fragments are never sent to a server in an HTTP request at all, meaning no
server-side code could ever generate real per-page meta tags for social link previews or crawlers
that don't execute JS under that scheme — a real, structural blocker, not a missing feature.
**Every environment that serves this app now needs a real server** — `npm run dev` and
`vite preview` still work locally (both are real dev servers), but opening `dist/index.html`
directly via `file://` no longer works, and production requires the real server in `server.cjs`
(run via `npm start`) rather than whatever static-file serving was happening before. See
`ROADMAP.md`'s change log for the full detail on why, and what this required.
`public/sitemap.xml` is still generated from the same routing data via
`node scripts/generate-sitemap.mjs`, so it can't silently drift out of sync with the app's actual
pages — only its own URL format needed to change to match.

Per-page `<title>` and meta description are set dynamically on every route change (see
`useDocumentMeta` in `src/hooks/index.js`) for the client, and independently by `server.cjs` for
the initial HTML response any crawler actually sees — both read from the same `PAGE_META` table
(`src/data/index.js`) via a build-time extraction step, so they can't silently drift apart.

## Known limitations (by design, not oversight)

**This section is now significantly stale and needs a real rewrite** — found while updating the
routing section above, not something this specific change caused. It still describes payment as
"inert," admin auth as fake, and almost nothing as persisting past a refresh, none of which has
been true for a long time now: real auth, real orders, real payments (including refunds and
webhooks), real products and green coffee catalogs, real email, and real file storage are all
live — see `ROADMAP.md`'s change log for the actual, current state. Left as its original text
below rather than rewritten here, since accurately describing everything that's now real is a
substantial task of its own, not something to fold into a routing change.

- **Nothing persists except cart and wishlist**, and only if you accept the local-storage consent
  banner. Orders, journal entries, and admin edits reset on refresh — everything else is intentionally
  in-memory (see `SECURITY.md` for why that's actually a safety feature right now, not a bug).
- **Admin authorization is not real.** Covered above and in `SECURITY.md` — please don't deploy this
  publicly and assume the Admin Dashboard is protected.
- **Payment is inert.** The checkout flow is complete end-to-end but no payment is ever processed.
- **No unit or integration tests, and the Playwright E2E suite has never actually been run** — see
  `tests/e2e/README.md` for exactly why (no route to Playwright's browser-binary CDN from the
  environment that built this) and what to check before trusting it in CI.
- **No cross-browser or real device testing has ever been performed on this project.** Every visual
  and responsive decision has been made through code review (CSS audits, computed contrast ratios,
  programmatic checks) rather than actually looking at it rendered — there is no visual-testing
  tool available in the environment that built this. Please look at it yourself before assuming
  anything renders as described.
