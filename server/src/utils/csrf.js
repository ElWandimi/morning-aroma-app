const crypto = require("crypto");
const { SESSION_COOKIE, verifyAccessToken } = require("./tokens");

// Double-submit pattern: a random token the frontend echoes back in a header, proving a request
// genuinely came from a page that could obtain this session's own token -- not just that a valid
// session cookie came along for the ride (which a forged cross-site request gets automatically).
// Also set as a cookie here (deliberately NOT httpOnly, so frontend JS *could* read it) for any
// deployment where frontend and backend genuinely share a domain -- but the primary, always-
// reliable channel is the token returned in the JSON body of every auth response
// (server/src/routes/auth.js's issueSession and /auth/me), which src/utils/api.js holds in memory
// and echoes back. This split exists because a real, live bug showed the cookie-only version
// doesn't work at all when frontend and backend are separate domains with no shared parent
// (morning-aroma.com vs *.up.railway.app here): a cookie the backend sets can never be scoped to
// be visible to document.cookie on a genuinely different origin, Domain attribute or not -- every
// mutating authenticated request 403'd in production as a result, confirmed directly (a valid
// session per GET /auth/me, yet POST /auth/logout consistently rejected for a missing token the
// frontend could never actually read). The body-returned token has the same security property as
// the cookie would: a fetch response body is exactly as inaccessible to a third-party attacker
// page as a cookie is, both governed by the same-origin policy.
const CSRF_COOKIE = "ma_csrf";
const CSRF_HEADER = "x-csrf-token";

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Not httpOnly (must be JS-readable) and not sameSite: "none" the same way the session cookie is
// -- this cookie carries no sensitive value on its own (a copy of it is useless to an attacker who
// can't also read it back off this origin to echo in the header), so there's nothing forcing the
// same cross-site-cookie tradeoff the actual session token needs. Still secure: true (never over
// plain HTTP) and still needs sameSite: "none" in practice, though, since the frontend and backend
// being cross-origin means this cookie has to be readable in the same cross-site request context
// the session cookie is sent in, or the frontend's own JS (running on the frontend's origin, not
// this API's) would never receive it on the response in the first place.
function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure: true, sameSite: "none", path: "/" });
}

// Only mutating methods need this check -- a GET request can't be a CSRF attack in the sense this
// defends against (it doesn't change state), and requiring the header on every read would force
// every single frontend call site to send it for no real protective benefit. Applied globally in
// app.js rather than per-route, so a newly added mutating route can't be added without this
// protection by a simple oversight -- it's the default, not something each route has to remember
// to opt into.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Pre-authentication endpoints are deliberately exempt, not an oversight: the actual attack this
// defends against is forging a state-changing request using a VICTIM's already-authenticated
// session -- tricking a victim's browser into submitting someone else's login form doesn't
// compromise the victim (it can only log them into an account they didn't choose, not act on
// their behalf), so there's no real victim-facing harm to defend against here, the same standard
// reasoning most real-world CSRF guidance gives for exempting login/register. Practically also
// necessary: a first-time visitor has no CSRF cookie yet (nothing has issued one until they've
// made a request this app's frontend actually handled), so requiring the header on the very
// request that would establish a session creates an unbreakable chicken-and-egg problem otherwise.
//
// /feedback and /newsletter are exempt for the same underlying reason, not a workaround: both are
// genuinely anonymous POST endpoints (no requireAuth, confirmed across every route file) that
// never read or act on a session cookie at all -- CSRF specifically defends against a forged
// request riding along on a VICTIM's authenticated session; an anonymous submission has no session
// to hijack, so there's nothing here for this mechanism to protect. The real concern for an
// anonymous POST (spam/abuse) is already handled by each route's own rate limiter, which is the
// actually-correct defense for that risk, not a CSRF token a first-time visitor couldn't have yet.
const CSRF_EXEMPT_PREFIXES = ["/auth/register", "/auth/login", "/auth/google", "/auth/otp", "/auth/password-reset", "/auth/verify-email", "/webhooks/", "/feedback", "/newsletter"];

function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();

  const sessionToken = req.cookies && req.cookies[SESSION_COOKIE];
  // If there's no session cookie at all, there's no authenticated session for CSRF to protect --
  // letting the request continue here means requireAuth (mounted on the actual protected routes)
  // is the one that rejects it, with a 401 that correctly explains the real reason ("not signed
  // in"), rather than this layer preempting that with a technically-true-but-less-meaningful 403
  // ("no CSRF token") that was never really what was wrong with the request. A previous version
  // of this check rejected here unconditionally, and needing this session cookie is what actually
  // showed the real, missing-auth failure to instead read as a CSRF failure on every "reject an
  // unauthenticated request" test in this suite -- 23 failures across otherwise-unrelated areas,
  // all traced back to this one ordering issue.
  if (!sessionToken) return next();

  // Decodes the SESSION cookie itself to read its embedded csrf claim (signAccessToken), rather
  // than trusting a second, independently-delivered ma_csrf cookie -- confirmed as a real, live
  // bug: that second cookie silently never reaches the browser's cookie jar for the frontend's own
  // origin at all when frontend and backend are genuinely separate domains with no shared parent,
  // so req.cookies[CSRF_COOKIE] here was always undefined in that deployment, 403ing every single
  // mutating request regardless of whether the session was otherwise completely valid. The session
  // cookie, by contrast, is proven to reliably survive the exact same cross-origin round trip --
  // it has to, for auth to work at all -- so its embedded claim is the trustworthy source.
  // requireAuth hasn't run yet at this point in the middleware chain (this is mounted globally,
  // before any route-level requireAuth), so this decodes independently rather than reading
  // req.user. An invalid/expired token here just means "not authenticated" -- falls through to
  // requireAuth for the real 401, same reasoning as the missing-cookie case above.
  let claimedCsrf;
  try {
    claimedCsrf = verifyAccessToken(sessionToken).csrf;
  } catch {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER];
  if (!claimedCsrf || !headerToken || claimedCsrf !== headerToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}

module.exports = { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken, setCsrfCookie, clearCsrfCookie, requireCsrfToken };
