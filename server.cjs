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
const fs = require("fs");
const path = require("path");
const { PAGE_META, SLUG_TO_PAGE, KNOWN_ROUTES, PRODUCTS } = require("./dist-data/routeMeta.cjs");

const app = express();
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = fs.readFileSync(path.join(DIST_DIR, "index.html"), "utf8");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mirrors App.jsx's getPageMeta for the id-based routes crawlers are most likely to actually hit
// via a shared link (product pages) -- not a full reimplementation of every route's dynamic
// title logic, which would mean keeping three copies (client, here, and the data itself) in sync
// instead of two. Static pages (PAGE_META directly) cover everything else, same table as the client.
function resolveMeta(pageRoute) {
  const { page, id } = pageRoute;
  if (page === "product" && id) {
    const p = PRODUCTS.find((p) => p.id === id);
    if (p) return { title: `${p.name} — ${p.country} | Morning Aroma`, description: p.note };
  }
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

function renderIndexWithMeta(urlPath) {
  const meta = resolveMeta(parseRoutePath(urlPath));
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description || "");
  return INDEX_HTML
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`);
}

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
  res.send(renderIndexWithMeta(req.path));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serving on port ${PORT}`));
