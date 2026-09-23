const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { query } = require("./db");
const { requireCsrfToken } = require("./utils/csrf");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");
const productsRoutes = require("./routes/products");
const greenBeansRoutes = require("./routes/greenBeans");
const settingsRoutes = require("./routes/settings");
const subscriptionsRoutes = require("./routes/subscriptions");
const coursesRoutes = require("./routes/courses");
const chaptersRoutes = require("./routes/chapters");
const quizzesRoutes = require("./routes/quizzes");
const certificatesRoutes = require("./routes/certificates");
const academyStatsRoutes = require("./routes/academyStats");
const feedbackRoutes = require("./routes/feedback");
const newsletterRoutes = require("./routes/newsletter");
const liveChatRoutes = require("./routes/live-chat");
const cartRoutes = require("./routes/cart");
const careerApplicationsRoutes = require("./routes/careerApplications");
const blogRoutes = require("./routes/blog");
const quotationsRoutes = require("./routes/quotations");
const serviceInquiriesRoutes = require("./routes/serviceInquiries");
const greenOrdersRoutes = require("./routes/greenOrders");
const contactMessagesRoutes = require("./routes/contactMessages");
const contentOverridesRoutes = require("./routes/content-overrides");
const webhooksRoutes = require("./routes/webhooks");

const app = express();

// Railway (like most PaaS platforms) sits its own reverse proxy in front of this server -- every
// real request arrives with the actual visitor's IP in the X-Forwarded-For header, not as the
// direct TCP connection, which Express's default `req.ip` would otherwise report as Railway's own
// internal proxy address. Without this, every single visitor resolves to the SAME `req.ip` --
// meaning the auth rate limiter below (server/src/routes/auth.js) was, until this fix, sharing its
// 20-requests-per-15-minutes production limit across ALL real visitors combined, not scoped to
// each individual one. A real fairness bug: enough simultaneous legitimate traffic could lock out
// innocent visitors who'd made nowhere near 20 requests themselves. `1` tells Express to trust
// exactly one hop of reverse proxy, matching Railway's architecture -- not `true`, which would
// trust the header from anywhere, letting a client spoof their own IP to bypass rate limiting
// entirely (this exact distinction is what express-rate-limit's own ERR_ERL_PERMISSIVE_TRUST_PROXY
// check exists to catch, if this were ever set too permissively instead of not set at all).
app.set("trust proxy", 1);

// Real, low-risk security headers (X-Content-Type-Options, X-Frame-Options/frame-ancestors,
// Referrer-Policy, and a few others helmet sets by default) -- none of these touch auth, payments,
// or change any response body or user-facing behavior, so unlike a Content-Security-Policy they're
// safe to turn on without a dedicated review. CSP specifically stays off for now (helmet's default
// is a strict one that would need every legitimate external resource this app actually loads
// allow-listed first -- Google Fonts, Cloudinary and Unsplash images, and critically Paystack's
// checkout script, since getting that wrong could silently break the one flow that must never
// break) -- flagged as a separate, deliberate follow-up rather than shipped as a guess.
app.use(helmet({ contentSecurityPolicy: false }));

// Real, dynamic sitemap for blog posts specifically -- the main, static public/sitemap.xml is
// generated at BUILD time (scripts/generate-sitemap.mjs) and genuinely has no database access,
// the same real constraint that already excludes Academy courses from it (see that script's own
// comment). Blog posts have the identical problem -- entirely database-driven, zero static data
// a build-time script could read -- so rather than leave them out of every sitemap forever (a
// real, meaningful loss for the whole point of building a blog: organic search discovery), this
// serves a real, separate, dynamic sitemap that always reflects the actual, current set of
// published posts. Referenced as an additional real entry in the main sitemap (standard sitemap-
// index practice), not a replacement for it.
app.get("/sitemap-blog.xml", async (req, res) => {
  // The real, actual public-facing domain -- not FRONTEND_URL's own Railway-staging fallback
  // (that's the right default for backend-generated email links, which work regardless of
  // domain, but a sitemap is specifically about what search engines should index, and indexing
  // the wrong domain would be a real, meaningful mistake). Same real reasoning
  // scripts/generate-sitemap.mjs's own SITE_ORIGIN already applies to the main sitemap.
  const siteUrl = process.env.SITE_ORIGIN || "https://morning-aroma.com";
  let posts = [];
  try {
    const result = await query("SELECT slug, updated_at FROM blog_posts WHERE status = 'Published' ORDER BY published_at DESC", []);
    posts = result.rows;
  } catch (e) {
    console.error("Failed to generate blog sitemap:", e);
  }
  const urlsXml = posts.map((p) => {
    const lastmod = (p.updated_at instanceof Date ? p.updated_at : new Date(p.updated_at)).toISOString().slice(0, 10);
    return `  <url>\n    <loc>${siteUrl}/blog-post/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
  }).join("\n");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`);
});

// Real, dynamic sitemap for Academy courses -- the exact same gap as blog posts above, and
// explicitly called out but never actually closed in scripts/generate-sitemap.mjs's own comment
// ("course ... stay excluded here, not an oversight ... courses now live in the real database").
// Courses are real, individually browsable pages (/course/:id) with real content (name, category,
// blurb, instructor) -- leaving them out of every sitemap means search engines have no real path
// to discover any of them at all, only the /academy hub page that links to them. Same shape as
// the blog sitemap: real slugs and real lastmod straight from the database, so this can never
// silently drift the way a hand-maintained list would the moment a course is added, renamed, or
// removed through Admin.
app.get("/sitemap-courses.xml", async (req, res) => {
  const siteUrl = process.env.SITE_ORIGIN || "https://morning-aroma.com";
  let courses = [];
  try {
    const result = await query("SELECT id, updated_at FROM courses WHERE removed = false ORDER BY name ASC", []);
    courses = result.rows;
  } catch (e) {
    console.error("Failed to generate courses sitemap:", e);
  }
  const urlsXml = courses.map((c) => {
    const lastmod = (c.updated_at instanceof Date ? c.updated_at : new Date(c.updated_at)).toISOString().slice(0, 10);
    return `  <url>\n    <loc>${siteUrl}/course/${c.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
  }).join("\n");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`);
});

// Mounted with express.raw(), and BEFORE the global express.json() below -- Paystack's webhook
// signature is an HMAC over the exact raw request body. If express.json() ran first, it would
// consume and parse that body before this route ever saw the original bytes, making a correct
// signature comparison impossible (see routes/webhooks.js for the full explanation). Doesn't need
// CORS either, unlike everything below it -- Paystack calls this server-to-server, not from a
// browser, so CORS (a browser-enforced mechanism) simply doesn't apply here.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRoutes);

// Default limit (100kb) is too small for the base64-encoded product photos admin uploads send
// (src/utils/helpers.js's resizeImageFile caps at 700px wide, JPEG quality 0.85, which can still
// realistically produce 100-300kb+ once base64-encoded, depending on image detail) -- a real,
// pre-existing bug that would have silently rejected a normal photo upload with a 413 before it
// ever reached a route handler, unrelated to anything about where the resulting URL gets stored.
// 5mb is generous headroom for a single resized image without being unbounded.
app.use(express.json({ limit: "5mb" }));

// Allows the deployed frontend's origin (and localhost during development) to call this API from
// the browser. Set FRONTEND_URL in the environment once the frontend's real Railway domain is
// known; without it, only localhost works, which is safe-by-default rather than accidentally
// open-by-default.
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Moved here (after CORS) from just after helmet() above: registered before cors(), this route
// never received Access-Control-Allow-Origin headers at all, so any cross-origin caller (the
// frontend's own JS doing a real health check, or an uptime monitor calling from a browser)
// got a hard network-level failure instead of a normal 200 -- confirmed live on production,
// where /health failed 100% of the time from https://morning-aroma.com while /products and
// /settings (both mounted after cors(), same as this now is) succeeded every time. Kept
// unauthenticated and dependency-free on purpose -- it's a liveness probe, not a readiness
// check, so it must never fail because the database or a third-party API is slow or down.
app.get("/health", (req, res) => res.json({ ok: true }));

// Must come after CORS (a cross-origin request's cookies are only readable here once CORS has
// already decided whether to allow it) and before every route below, including the webhook route
// -- cookie-parser itself is harmless there (Paystack's request has no cookies to parse), but
// requireCsrfToken specifically already exempts /webhooks/ internally rather than relying on route
// order to skip it, so a future reordering of these lines can't accidentally start requiring a
// browser-only CSRF header on a server-to-server call.
app.use(cookieParser());
app.use(requireCsrfToken);

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/orders", ordersRoutes);
app.use("/products", productsRoutes);
app.use("/green-beans", greenBeansRoutes);
app.use("/settings", settingsRoutes);
app.use("/subscriptions", subscriptionsRoutes);
app.use("/courses", coursesRoutes);
app.use("/", chaptersRoutes);
app.use("/", quizzesRoutes);
app.use("/", certificatesRoutes);
app.use("/", academyStatsRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/newsletter", newsletterRoutes);
app.use("/live-chat", liveChatRoutes);
app.use("/cart", cartRoutes);
app.use("/career-applications", careerApplicationsRoutes);
app.use("/blog", blogRoutes);
app.use("/quotations", quotationsRoutes);
app.use("/service-inquiries", serviceInquiriesRoutes);
app.use("/green-orders", greenOrdersRoutes);
app.use("/contact-messages", contactMessagesRoutes);
app.use("/content-overrides", contentOverridesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected promises from async route handlers here automatically -- confirmed
// directly rather than assumed, since this project's Express 4 knowledge (the far more common
// version, where this would NOT happen automatically) doesn't apply to what npm actually installed.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

module.exports = app;
