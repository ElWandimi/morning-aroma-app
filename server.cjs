// Real production server for the built frontend -- required now that routing is path-based
// (/shop/geisha-panama) rather than hash-based (#/shop/geisha-panama). A browser never sends the
// part of a URL after '#' in an HTTP request at all, so hash routing never needed any server-side
// awareness of which "page" was being requested -- every request was simply for '/'. Real paths
// change that: without this server explicitly falling back to index.html for any path Vite didn't
// build a real file for, a direct link or a page refresh on any non-home route would 404, since
// there's no actual file on disk at e.g. /shop/geisha-panama -- that route only exists client-side,
// resolved by React after index.html has already loaded and run.
//
// Also does real per-page meta tag injection for crawlers that don't execute JS (social link
// previews -- Facebook, Twitter/X, LinkedIn -- and some SEO crawlers), which is the actual reason
// this migration from hash routing happened. This is deliberately NOT full server-side rendering
// of the React app itself (a much larger undertaking) -- just the meta tags a crawler actually
// reads, mirroring the same PAGE_META table and per-item logic App.jsx already uses client-side
// (see getPageMeta in App.jsx and PAGE_META in src/data/index.js) so the two can't drift apart
// without both being touched.

const express = require("express");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
const { PAGE_META, SLUG_TO_PAGE, KNOWN_ROUTES, PRODUCTS, MOMENTS, BREW_GUIDES, COUNTRIES, GROWING_FACTORS } = require("./dist-data/routeMeta.cjs");

const app = express();
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = fs.readFileSync(path.join(DIST_DIR, "index.html"), "utf8");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Same simple slugify as src/utils/helpers.js -- inlined rather than required directly, since
// that file is an ES module bundled by Vite for the browser, the same reason routeMeta.cjs itself
// exists rather than this script requiring src/data/index.js directly.
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const suffix = " | Morning Aroma";

// Mirrors App.jsx's getPageMeta exactly, for every route type that data is actually available
// for at build time -- product, moment, brewguide, country, growingfactor, and growingprofile
// (which shares product's own data). "course" is the one deliberate exception: courses now live
// in the real database (see ROADMAP.md), not static data this script can read without adding a
// real network dependency to every build -- same real limitation already documented in
// scripts/generate-sitemap.mjs. A shared link to a course page still falls back to the generic
// Academy hub's title/description for a crawler that doesn't execute JS, same as before this fix.
function resolveMeta(pageRoute) {
  const { page, id } = pageRoute;
  if ((page === "product" || page === "growingprofile") && id) {
    const p = PRODUCTS.find((p) => p.id === id);
    if (p) return { title: `${p.name} — ${p.country}${suffix}`, description: p.note };
    return PAGE_META[page === "product" ? "shop" : "growing"];
  }
  if (page === "moment" && id) {
    const m = MOMENTS.find((m) => m.id === id);
    return m ? { title: `${m.name}${suffix}`, description: m.benefit } : PAGE_META.moments;
  }
  if (page === "brewguide" && id) {
    const b = BREW_GUIDES.find((b) => slugify(b.name) === id);
    return b ? { title: `${b.name} Brew Guide${suffix}`, description: b.flavor } : PAGE_META.brewguides;
  }
  if (page === "country" && id) {
    const c = COUNTRIES.find((c) => slugify(c.name) === id);
    return c ? { title: `${c.name}${suffix}`, description: c.climate } : PAGE_META.growing;
  }
  if (page === "growingfactor" && id) {
    const f = GROWING_FACTORS.find((f) => slugify(f.name) === id);
    return f ? { title: `${f.name}${suffix}`, description: f.explain } : PAGE_META.growing;
  }
  // Real course data lives in the database, not this script's static build-time data (same
  // limitation the sitemap generator documents for the same reason) -- a crawler that doesn't
  // execute JS previously saw the plain HOMEPAGE'S title/description here for every single course
  // page, since "course" has no entry in PAGE_META at all and this function's final line falls
  // all the way back to PAGE_META.home. Falls back to Academy's own real hub meta instead --
  // still generic for a specific course, but genuinely about coffee courses rather than an
  // unrelated homepage description, and a real fix that doesn't require adding a network
  // dependency to the build to fetch live course data.
  if (page === "course") return PAGE_META.academy;
  return PAGE_META[page] || PAGE_META.home;
}

function parseRoutePath(urlPath) {
  const raw = urlPath.replace(/^\/+/, "").split("?")[0];
  if (!raw) return { page: "home" };
  const [slug, rawId] = raw.split("/");
  const page = SLUG_TO_PAGE[slug];
  if (!page || !KNOWN_ROUTES.has(page)) return { page: "home" };
  return rawId ? { page, id: decodeURIComponent(rawId) } : { page };
}

// Real, live production domain by default -- matches the same SITE_ORIGIN pattern and fallback
// already established in scripts/generate-sitemap.mjs, not a placeholder or a wrong domain.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://morning-aroma.com";

// Mirrors the real content of src/pages/Misc.jsx's PrivacyPolicyPage -- kept here as plain HTML
// specifically so it can be injected server-side for /privacy (see renderIndexWithMeta below).
// /privacy is otherwise a client-side-only React route, meaning any crawler that doesn't execute
// JavaScript -- including, per Google's own documented verification requirements, their OAuth
// consent screen homepage/privacy-policy checker -- would see the exact same empty loading shell
// for /privacy as for every other route, and never see the Google user data disclosure Google
// specifically scans for. If the policy text in Misc.jsx changes, update this to match.
const PRIVACY_POLICY_STATIC_HTML = `
  <div style="text-align:left; max-width: 640px; font-size: 0.85rem; line-height: 1.6; margin-top: 12px;">
    <h2>Privacy Policy</h2>
    <h3>What we collect</h3>
    <p>When you use Morning Aroma, we collect information you give us directly: your name and
    email when you create an account or sign in (including, if you choose, via "Sign in with
    Google" -- see below); shipping details at checkout; the notes, ratings, and varieties you log
    in My Aroma Journey; messages you send through our contact and inquiry forms or live chat; and
    reviews submitted through "Leave Your Aroma," which are anonymous and not linked to your
    account. We do not collect or store your full payment card details ourselves -- payment is
    processed directly by Paystack, and we only receive confirmation of whether a payment
    succeeded.</p>
    <h3>How we use it</h3>
    <p>We use this information to fulfil orders, respond to inquiries, personalize recommendations
    based on your tasting history, and improve the site. We do not sell your personal information
    to third parties.</p>
    <h3>Third-party services we use</h3>
    <p>Paystack processes all real payments and subscriptions. Resend sends our transactional
    emails. Cloudinary hosts product and content photos. Sentry receives error reports, only after
    explicit consent, and never receives your IP address.</p>
    <p><strong>Google</strong> provides the optional "Sign in with Google" button. If you use it,
    our application accesses your name, email address, and profile photo from your Google account,
    so we can create or sign you into your Morning Aroma account. We do not access your contacts,
    files, or any other Google data, and we never post to your Google account on your behalf. Our
    use of information received from Google APIs adheres to the Google API Services User Data
    Policy, including the Limited Use requirements.</p>
    <h3>Data retention and your rights</h3>
    <p>You can request a copy of the data we hold about you, ask us to correct it, or ask us to
    delete your account and associated data, by contacting hello@morning-aroma.com. We retain order
    records as required for accounting and legal purposes; other data is kept only as long as your
    account is active or as needed to provide the service.</p>
    <h3>Children's privacy</h3>
    <p>Morning Aroma is not directed at children under 16, and we do not knowingly collect
    information from them.</p>
    <h3>Contact</h3>
    <p>Questions about this policy: hello@morning-aroma.com.</p>
  </div>
`;

function renderIndexWithMeta(urlPath) {
  const meta = resolveMeta(parseRoutePath(urlPath));
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description || "");
  // The real, current page's own URL -- was missing from this replacement list entirely before
  // this, meaning any crawler that doesn't execute JS (many social media link-preview bots: a
  // real, separate audience from Googlebot, which does run JS and would see the client-side fix
  // in useDocumentMeta) always saw the homepage's URL here, regardless of which page was actually
  // being shared. urlPath already excludes any query string (see parseRoutePath above).
  const realUrl = `${SITE_ORIGIN}${urlPath.split("?")[0]}`;
  let html = INDEX_HTML
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content=".*?"\s*\/?>/, `<meta property="og:url" content="${realUrl}" />`)
    .replace(/<link rel="canonical" href=".*?"\s*\/?>/, `<link rel="canonical" href="${realUrl}" />`)
    .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`);
  if (urlPath.split("?")[0] === "/privacy") {
    html = html.replace(
      /(Privacy Policy<\/a>\s*<\/p>)/,
      `$1${PRIVACY_POLICY_STATIC_HTML}`
    );
  }
  return html;
}

// Same reasoning and same deliberate CSP omission as the backend API's own helmet setup
// (server/src/app.js) -- real, low-risk headers on every response this server sends (every real
// page a visitor loads goes through this server, not just the API), CSP left for a dedicated
// follow-up since getting it wrong here specifically risks breaking Google Fonts, Cloudinary/
// Unsplash images, or Paystack's checkout script loading on the actual pages people see.
//
// crossOriginOpenerPolicy is overridden from helmet's own default ("same-origin") to
// "same-origin-allow-popups" -- a real, live bug, not a hypothetical: helmet's default value
// process-isolates this page from anything it opens via window.open(), which severs
// window.opener on the popup's side. Google's own Sign In With Google button opens exactly such
// a popup (accounts.google.com, a different origin) and its own script tries to postMessage back
// through that now-severed opener reference -- confirmed directly as the actual cause of a
// completely blank popup with "Cannot read properties of null (reading 'postMessage')" in its
// console, reproduced consistently on the real production site. same-origin-allow-popups keeps
// the same process-isolation benefit for ordinary cross-origin navigations while specifically
// preserving the opener relationship for popups this page itself opens, which is exactly the
// carve-out documented for this exact scenario.
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } }));

// Railway's own health check -- kept ahead of the SPA fallback so it always gets a real response
// regardless of what routes exist client-side, the same reasoning Railway's own SPA guide gives.
app.get("/health", (req, res) => res.json({ ok: true }));

// Fingerprinted build assets (Vite hashes filenames under /assets) are safe to cache forever --
// a new deploy produces new filenames, it never reuses one with different content.
app.use("/assets", express.static(path.join(DIST_DIR, "assets"), { immutable: true, maxAge: "1y" }));
app.use(express.static(DIST_DIR, { index: false }));

// Catch-all fallback: any path Vite didn't build a real file for (i.e. every client-side route)
// gets index.html, with real per-page meta tags injected based on the actual requested path.
// No path pattern here (not app.get("*", ...)) -- Express 5's underlying path-to-regexp no longer
// accepts a bare "*" wildcard at all (a real breaking change from Express 4), and path parameter
// extraction was never actually needed anyway, since req.path is read directly in the handler.
// A path-less app.use() runs for anything the two static-file middlewares above didn't already
// handle, which is exactly the fallback behavior this needs.
app.use((req, res) => {
  res.set("Content-Type", "text/html");
  // Must never be cached, by the browser or by Cloudflare (this domain is proxied through it) --
  // it references hashed JS filenames that change on every deploy, and those old files are gone
  // from the server the moment a new build replaces dist/. A stale cached copy of this exact page
  // pointing at now-deleted assets is what leaves a visitor stuck on the static loading screen
  // forever after a deploy, since the failed script load happens before any of the app's own code
  // -- including its own error handling -- ever gets a chance to run.
  res.set("Cache-Control", "no-store, must-revalidate");
  res.send(renderIndexWithMeta(req.path));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serving on port ${PORT}`));
