const crypto = require("crypto");
const { SESSION_COOKIE } = require("./tokens");

// Real CSRF protection -- a genuinely new requirement introduced by moving the session token into
// a cookie. The previous localStorage + Authorization-header approach was immune to CSRF by
// construction (a malicious site can't read another origin's localStorage or forge a custom
// header on a cross-site request it doesn't control), so nothing existed here before. An httpOnly
// cookie is sent automatically by the browser on every request to this origin -- including ones a
// malicious page on a different site triggers without the visitor's knowledge -- so something
// else has to prove a request genuinely originated from this app's own frontend, not just that a
// valid session cookie came along for the ride.
//
// Double-submit cookie pattern: a second cookie holds a random token, deliberately NOT httpOnly
// (the frontend must be able to read it with JS to echo it back) and NOT tied to the user's
// identity on its own -- a third-party site can plant its own cookies for this origin, but per the
// same-origin policy it cannot read this cookie's value or set the custom header to match it,
// since only JS running on this app's own origin can do both. Checking header === cookie is what
// actually proves the request came from a page that could read this origin's cookies.
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

  // If there's no session cookie at all, there's no authenticated session for CSRF to protect --
  // letting the request continue here means requireAuth (mounted on the actual protected routes)
  // is the one that rejects it, with a 401 that correctly explains the real reason ("not signed
  // in"), rather than this layer preempting that with a technically-true-but-less-meaningful 403
  // ("no CSRF token") that was never really what was wrong with the request. A previous version
  // of this check rejected here unconditionally, and needing this session cookie is what actually
  // showed the real, missing-auth failure to instead read as a CSRF failure on every "reject an
  // unauthenticated request" test in this suite -- 23 failures across otherwise-unrelated areas,
  // all traced back to this one ordering issue.
  if (!(req.cookies && req.cookies[SESSION_COOKIE])) return next();

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}

module.exports = { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken, setCsrfCookie, clearCsrfCookie, requireCsrfToken };
