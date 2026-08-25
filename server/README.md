# Morning Aroma — Auth Server

Real authentication backend for Morning Aroma: password hashing (bcrypt), JWT sessions, and
password reset. This is Tier 1 of `../ROADMAP.md` — the first of the two things blocking a real
launch (payments is the other).

## What's here

- `POST /auth/register` — create an account
- `POST /auth/login` — returns a JWT
- `GET /auth/me` — the current user, requires `Authorization: Bearer <token>`
- `POST /auth/logout` — no-op server-side (JWTs are stateless); real logout is discarding the
  token client-side
- `POST /auth/password-reset/request` — always returns the same generic message whether or not
  the email has an account, to avoid leaking which emails are registered
- `POST /auth/password-reset/confirm`
- `GET /users` (admin-only) — list every real registered account
- `PATCH /users/:id` (admin-only) — change a real account's role/permissions
- `POST /orders` — create an order for the signed-in user
- `GET /orders/mine` — the signed-in user's own orders
- `GET /orders` (admin-only) — every order, with the customer's email/name attached
- `PATCH /orders/:id/status` (admin-only) — move an order through Processing → Roasting → Shipped
  → Delivered (or Cancelled/Refunded)
- `POST /orders/:id/cancel` — a customer cancelling their own order, only while it's still
  Processing (matches the existing frontend's restriction: once fulfillment has started, only
  admin can change status further). For a **paid** order, also only within a 10-minute window of
  payment (`CANCELLATION_WINDOW_MINUTES` in `routes/orders.js`) — an unpaid order (an abandoned
  checkout) can still be cancelled anytime, since no real money is involved yet. Cancelling a paid
  order restores stock for every item, marks `payment_status` as `refund_pending` (a real refund
  is now owed), and emails every `super_admin` a notification — refunds are a deliberate,
  admin-triggered action, not automatic.
- `POST /orders/:id/refund` (admin-only) — the real refund action referenced above. Only succeeds
  for an order genuinely in `refund_pending`, enforced server-side. Calls Paystack's real Refund
  API using the order's stored `paystack_reference`; Paystack itself can then take up to 10
  business days to actually deliver funds back to the customer — this endpoint only confirms
  Paystack accepted the request, and updates `payment_status` to `refunded` once it has.
- `POST /orders/:id/verify-payment` — confirms a Paystack payment for the caller's own order.
  Requires `{ reference }`. Never trusts the frontend's report of success — always re-verifies
  with Paystack's real API using `PAYSTACK_SECRET_KEY`, checks the transaction actually succeeded,
  the currency is KES, and the amount is within 5% of what's owed (exchange rates drift between
  order and payment, so this can't require an exact match). Requires `PAYSTACK_SECRET_KEY` set —
  see `.env.example`.
- `POST /webhooks/paystack` — a second, more reliable payment confirmation path alongside the
  frontend-triggered one above. The frontend endpoint only fires if the customer's browser is
  still open and the JS actually runs after Paystack's popup closes; this fires from Paystack's
  own servers regardless, so a payment still gets confirmed even if someone closes the tab the
  instant they finish paying. Shares the exact same verification rules as the endpoint above
  (`src/utils/paymentVerification.js`) — the two can't quietly drift apart on what counts as
  genuinely paid. Requires the webhook URL to actually be registered with Paystack (Settings →
  API Keys & Webhooks → your deployed backend URL + `/webhooks/paystack`) before Paystack will
  ever call it — this is a manual dashboard step, not something set via an environment variable.
- `GET /products` — public, no auth required (customers need to browse without signing in).
  Excludes soft-deleted (discontinued) products.
- `POST /products` (admin-only) — creates a product. Generates the id as a slug from name +
  country (`slugify(name-country)`), matching the frontend's own `slugify` exactly, since real
  orders, cart, and wishlist all reference products by this id.
- `PATCH /products/:id` (admin-only) — updates any subset of fields (just a price, just a photo,
  a full edit). Fields not included in the request keep their current value.
- `DELETE /products/:id` (admin-only) — soft-delete, not a real row deletion. Matches the existing
  "discontinued item" behavior the frontend already has (Journey.jsx shows a fallback for order
  history referencing a removed product) — a real past order that referenced this product by id
  needs the id to keep existing.

## Real photo storage

Both `POST /products` and `PATCH /products/:id` genuinely upload a photo to Cloudinary
(`src/utils/cloudinary.js`) rather than storing the raw base64 image directly in the database —
requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (see
`.env.example`). The admin upload forms already resize an image client-side and send it as a
base64 data URL; nothing about that changed — only what the backend does with that string did.
A `photoUrl` that's already a real URL (unchanged from a previous save) passes through untouched
rather than triggering a pointless re-upload every time an unrelated field gets edited.

Fixed a real, separate bug found while building this: `POST /products` accepted `photoUrl` in the
request body but never actually included it in the `INSERT` — a photo uploaded while creating a
brand-new product was silently dropped every single time, not just stored as base64 instead of a
real URL. Also raised the global JSON body size limit from Express's 100kb default to 5mb — a
real, pre-existing bug found in the same pass, unrelated to where the resulting URL is stored: a
normally-sized resized product photo (client-side capped at 700px wide, JPEG quality 0.85) can
still realistically exceed 100kb once base64-encoded, and would have been silently rejected with
a 413 before ever reaching a route handler.
- `GET /green-beans`, `POST /green-beans`, `PATCH /green-beans/:id`, `DELETE /green-beans/:id` —
  the same real catalog treatment as `/products` above, applied to the parallel wholesale (green,
  unroasted) coffee system. Generates ids as `green-<slug>`, matching the frontend's existing
  format. `roastedId` optionally links a lot to its corresponding retail roast in `products`,
  enforced as a real foreign key. Cross-field validation (minimum order can't exceed stock) is
  checked against the real, current state on a partial update, not just the fields in that
  specific request — a stock-only edit that would leave an existing minimum order too high is
  correctly rejected.

## Both real catalogs are fully wired, frontend included

Admin Products/Inventory, Shop, Product detail pages, Cart, Checkout, Search, the Quiz, and the
Green Coffee page all read from the real APIs above — nothing left reading stale static data or
client-side-only overrides for either catalog. Found and fixed two real bugs while wiring the
green coffee frontend specifically, more severe than anything found wiring products: the page
would throw an actual runtime exception (not just show a stale value) during the instant before
the real catalog's first fetch completed, since its initial state assumed a selected lot always
exists; and its initial "which lot is selected" state depended on the old static import's first
id, which had no real guarantee of matching anything in the actual fetched data. Both fixed with
safe defaults and an explicit loading/empty state, checked directly rather than assumed safe.

## Order price integrity

`POST /orders` looks up each item's real, current price from the `products` table and uses that
for the actual total — the client-submitted `unitPriceCents` is validated for shape (still
required, still must be a non-negative integer, for backward compatibility with the existing
frontend contract) but is genuinely ignored for pricing. A submitted price that doesn't match
reality can't produce a wrong order total; it just gets silently overridden with the real one. An
item referencing a product that doesn't exist, or one that's been discontinued since, is rejected
outright (400) rather than silently accepted.

Real stock is also decremented for every item, but only at the moment a payment is genuinely
confirmed (`paymentVerification.js`'s shared `verifyAndMarkOrderPaid`) — not at order creation.
An order that's merely created but never paid (an abandoned checkout) never reduces what's
actually available. Clamped at zero rather than allowed to go negative; this app doesn't reserve
stock at order-creation time, so two near-simultaneous payments for the last unit can still both
succeed — a known, accepted tradeoff at this project's scale, not a full reservation system.

## What's *not* here yet

- **Real email delivery to arbitrary customers.** Real Resend integration is built and tested
  (`server/src/utils/email.js`) — welcome emails and password reset emails genuinely send once
  `RESEND_API_KEY` is set (see `.env.example`). The real limitation: Resend requires a verified
  domain to deliver to arbitrary recipients; without one, the only working sender is Resend's own
  `onboarding@resend.dev`, which can only reach the Resend account's own registered email, not
  real customers. The project owner doesn't own a domain yet — this is genuinely blocked on that,
  not on more code.
- **2FA and Google OAuth.** The frontend has UI for both already; this backend doesn't implement
  either side yet.

## Local development

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL (a real Postgres instance) and JWT_SECRET (32+ random characters)
npm run dev
```

Apply `migrations/001_init.sql` to your database before starting the server — there's no
migration runner set up yet, so for now this means running that file's contents directly against
your Postgres instance (`psql $DATABASE_URL -f migrations/001_init.sql`, or paste it into
Railway's database query console).

## Testing

```bash
npm test
```

Runs `test/run-e2e.js` — real HTTP requests against the actual, unmodified route handlers in
`src/routes/auth.js`, using SQLite as a stand-in database (`test/db.sqlite.js`) rather than a
mocked one. Production uses Postgres via `pg` (`src/db.js`); the SQLite substitution exists only
because this specific development environment can't install real Postgres, and is never imported
by any production code path. Covers registration (including duplicate-email and weak-password
rejection), login (correct/wrong/nonexistent), the JWT-protected `/me` endpoint, and the full
password-reset round-trip including confirming a used reset token can't be replayed.

## Deploying to Railway

1. In your existing Railway project, add a new service — "Deploy from GitHub repo", same repo as
   the frontend, but set the **root directory** to `server`.
2. Add a Postgres database to the same project (Railway → New → Database → PostgreSQL). This
   automatically sets `DATABASE_URL` for services in the same project — you shouldn't need to
   copy it manually.
3. Run `migrations/001_init.sql` against that database once (Railway's database dashboard has a
   query console, or connect via `psql` using the connection string Railway shows you).
4. Set the remaining environment variables on the server service: `JWT_SECRET` (generate one
   locally with the command in `.env.example`, don't reuse the dev one), `FRONTEND_URL` (your
   deployed frontend's actual Railway URL), `NODE_ENV=production`.
5. Railway auto-detects the start command from `package.json` (`npm start`) — no extra
   configuration needed there.
6. Once deployed, `https://<this-service>.up.railway.app/health` should return `{"ok":true}`.
