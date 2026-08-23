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
  admin can change status further)
- `POST /orders/:id/verify-payment` — confirms a Paystack payment for the caller's own order.
  Requires `{ reference }`. Never trusts the frontend's report of success — always re-verifies
  with Paystack's real API using `PAYSTACK_SECRET_KEY`, checks the transaction actually succeeded,
  the currency is KES, and the amount is within 5% of what's owed (exchange rates drift between
  order and payment, so this can't require an exact match). Requires `PAYSTACK_SECRET_KEY` set —
  see `.env.example`.

## Known limitation: order totals aren't fully price-verified yet

`POST /orders` recomputes the total from the submitted per-item prices rather than trusting a
submitted grand total directly, which blocks the most obvious form of tampering (mismatched
items/total). But the per-item prices themselves still come from the client, not a real product
catalog — products and pricing haven't been migrated to this database yet (they're still frontend
static data, per ROADMAP.md). This is real order *persistence* (orders survive a refresh, admin
can see them, a customer's order history is genuinely theirs) — not yet a fully trustworthy
checkout from a pricing-integrity standpoint. Real price verification needs the product catalog
to exist here too, which is its own, larger piece of work.

## What's *not* here yet

- **Real email delivery.** Password reset tokens are logged to the server console in development
  (`NODE_ENV !== "production"`) instead of emailed — there's no email provider wired up yet (see
  ROADMAP.md Tier 2). The token logic itself is fully built and tested; only the "send an email"
  step is missing.
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
