# Security

This document covers two things: what's actually enforced in this prototype today, and
what a production deployment of Morning Aroma would need on top of it. Being clear about
that boundary matters more here than anywhere else in the README — a prototype that *looks*
secure but isn't can be worse than one that's honest about its limits.

## What this prototype actually does

- **No secrets in the codebase.** There is nothing to leak — no API keys, no database
  credentials, no payment processor keys — because there's no real backend behind it yet.
- **No real credential handling.** The demo login, OTP flow, and Google account picker are
  all simulated client-side. No password is ever hashed, transmitted, or stored anywhere
  real — it's compared to one hardcoded demo value in memory and forgotten on refresh.
- **Input length limits.** Free-text fields (journal notes, feedback, quotation requests,
  contact messages, admin content edits) all carry `maxLength` constraints to prevent
  pathological input, even though nothing is persisted server-side today.
- **No `dangerouslySetInnerHTML` anywhere.** All user-supplied text is rendered through
  React's default JSX text interpolation, which HTML-escapes automatically. There is no
  code path in this app that renders raw, unescaped user input as HTML.
- **No `eval`, no `new Function()`, no dynamic code execution** of any kind.
- **No third-party script injection.** The only external resources loaded are Google Fonts
  (stylesheet only) and, on-demand, the `jspdf` package for recipe card PDFs — both loaded
  through normal bundled imports, not injected `<script>` tags.
- **Payment fields are inert.** The checkout "payment" step collects fake card details for
  demonstration only. Nothing is transmitted, validated, or stored — it exists purely to
  show where a real payment processor (Paystack, per the project owner's decision) would integrate.
- **Autocomplete hints are set correctly** on auth fields (`username`, `current-password`,
  `one-time-code`) so password managers and mobile OS autofill behave as users expect.

## What "Admin" access actually means here — read this carefully

The Admin Dashboard checks `user.role === "super_admin"` **in the browser**, in JavaScript
that ships to every visitor. This is enough to demo the feature, and enough to keep an
ordinary user from stumbling into it by accident. **It is not real access control.** Anyone
with browser developer tools can inspect or modify client-side state. In this prototype
that's a low-stakes fact, because there is nothing behind it to protect — no real database,
no real other users' data, no real money moving. It becomes a real vulnerability the moment
any of this is connected to genuine backend data, which is exactly why the section below
exists.

## What a production deployment needs (none of this exists yet)

If this prototype's frontend became the UI for a real store, the backend build would need,
at minimum:

**Authentication & authorization**
- Real password hashing (bcrypt or argon2) — never store or compare plaintext passwords.
- Server-side session validation on *every* request, not just a client-side role check.
  The `/admin` routes, and every admin API endpoint, must re-verify the caller's role on
  the server on every call — the frontend check is a convenience, not a gate.
- Rate limiting on login and OTP endpoints (the spec's "3 requests per 5 minutes, 3 failed
  attempts invalidates the code" needs to be enforced server-side with Redis or similar —
  a client-side counter, like this prototype's, can be reset by just reloading the page).
- CSRF protection on any state-changing request if using cookie-based sessions.
- Secure, `HttpOnly`, `SameSite` cookies for session tokens (this is what NextAuth.js
  handles out of the box, per the original brief).

**Data handling**
- Parameterized queries / an ORM (Prisma, per the original brief) for all database access —
  never string-concatenate user input into SQL.
- Server-side input validation and sanitization on every write path, independent of
  whatever the frontend already validates (frontend validation is a UX nicety, not security).
- Least-privilege database credentials — the app's DB user should not be able to drop
  tables or access schemas it doesn't need.

**Payments**
- Real payment processing must go through a PCI-DSS-compliant processor (Paystack, per the
  project owner's decision) using their hosted fields or Inline JS — raw card numbers should never
  touch this application's own servers.

**Transport & headers**
- HTTPS everywhere, HSTS enabled.
- A Content-Security-Policy that restricts script/style/image sources.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or a frame-ancestors CSP),
  and a reasonable `Referrer-Policy`.

**Operational**
- Dependency vulnerability scanning (`npm audit`, Dependabot, or similar) as part of CI.
- Environment variables for all secrets (see `.env.example`), never committed to git.
- Logging that captures security-relevant events (failed logins, role changes) without
  logging sensitive data (passwords, full card numbers, OTP codes) in plaintext.

## Reporting

This is a prototype project, not a live service — there's no live attack surface to report
issues against. If you fork this into something real, put a real contact / disclosure
process here before you launch.
