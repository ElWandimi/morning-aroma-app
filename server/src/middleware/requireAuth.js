const { verifyAccessToken, SESSION_COOKIE } = require("../utils/tokens");
const { query } = require("../db");

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
async function requireAuth(req, res, next) {
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
    // One real, lightweight query, genuinely necessary despite the "don't re-fetch on every
    // request" tradeoff described above for role/permissions -- this one specifically exists to
    // catch a token that should no longer be trusted AT ALL (see signAccessToken's own comment on
    // tokenVersion, and migrations/022_token_version.sql): a stolen session cookie previously
    // stayed valid for its full 7-day life even after the real owner reset their password, since
    // nothing ever checked anything about the token beyond its own signature and expiry. Selects
    // only the one column actually needed here (not the full row, unlike requireAdmin's own
    // re-fetch, which genuinely needs the current role/permissions to hand back) to keep the real,
    // per-request cost of this specific check as small as it can be.
    const result = await query("SELECT token_version FROM users WHERE id = $1", [payload.sub]);
    const currentUser = result.rows[0];
    if (!currentUser || currentUser.token_version !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
