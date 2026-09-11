const { verifyAccessToken, SESSION_COOKIE } = require("../utils/tokens");

// Protects a route: requires a valid session cookie. On success, attaches the decoded token
// payload (sub/email/role) to req.user for the route handler to use — it does NOT re-fetch the
// user from the database on every request, so req.user.role reflects the role at the time the
// token was issued, not necessarily right now. A role change (e.g. admin promotes someone to
// staff) only takes effect the next time that user logs in / gets a fresh token, which is a
// deliberate, standard JWT tradeoff, not an oversight — routes that need up-to-the-second
// permission checks should re-query the database explicitly rather than trust req.user alone.
//
// Previously read the token from an `Authorization: Bearer` header, matching how the frontend
// used to store it in localStorage and attach it manually to every request. Now reads the httpOnly
// cookie cookie-parser already decoded into req.cookies (see app.js) -- the browser attaches it
// automatically, so there's nothing for the frontend to manually read or send here at all.
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Not signed in." });
  }
  try {
    const payload = verifyAccessToken(token);
    // A valid signature alone isn't enough -- signPendingTwoFactorToken (utils/tokens.js) is
    // signed with this same secret, since there's only one JWT_SECRET in this app, but it must
    // never be usable as a real session token. Real access tokens (signAccessToken) never set a
    // `type` claim at all, so refusing anything that does is a general, future-proof check, not
    // just a special case hardcoded for "2fa_pending" specifically -- any other short-lived,
    // narrowly-scoped token type added later gets the same protection automatically.
    if (payload.type) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
