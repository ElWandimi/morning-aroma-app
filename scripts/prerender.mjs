// Generates static HTML snapshots of every static/detail page for real search-engine indexing.
//
// Why this exists: this app is a pure client-side SPA. server.cjs already injects real per-page
// <head> meta tags server-side, but the actual page BODY served to any crawler that doesn't run
// JavaScript is always the same generic #ma-preload loading boilerplate -- there is no real
// product/price/listing content in the raw HTML until React hydrates client-side. Google Search
// Console showing only 5 of 68 known pages indexed (out of ~76 real routes) is the direct symptom:
// Googlebot does run JS and eventually renders most pages, but a page that looks empty on first
// paint competes poorly for indexing budget and ranking against a page whose real content is
// already in the HTML.
//
// This is deliberately NOT full server-side rendering (no react-dom/server, no rewriting how
// RouteProvider/AdminDataProvider fetch data) -- that would be a much larger, riskier rewrite,
// since those providers do live API fetches and touch window.location directly. Instead, this
// script drives the REAL built app in a real headless browser, waits for it to finish rendering
// exactly as a real visitor's browser would, and freezes the resulting DOM to disk. server.cjs
// then serves that frozen snapshot to a first request, while the exact same JS bundle still loads
// and hydrates on top of it for full interactivity -- visitors and crawlers alike get a fully
// interactive app, crawlers just also get real content on the very first response.
//
// MUST be run somewhere with real network access to the live backend API (Railway) and the two
// live third-party APIs the app calls on load (open.er-api.com, ipwho.is) -- otherwise every
// snapshot freezes empty/error states instead of real product data. Run on your own machine or CI,
// never inside a network-restricted build sandbox. Requires `dist/` to already exist (run after
// `vite build`, i.e. after the existing build steps).
//
// Usage:
//   BACKEND_URL=https://upbeat-rebirth-production.up.railway.app node scripts/prerender.mjs
// Optional:
//   PRERENDER_PORT=4173            (local static server port for dist/, default 4173)
//   PRERENDER_CONCURRENCY=4        (parallel pages, default 4)

import { chromium } from "@playwright/test";
import { createServer } from "http";
import { readFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PAGE_TO_SLUG, PRODUCTS, COUNTRIES, MOMENTS, BREW_GUIDES } from "../src/data/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const OUT_DIR = path.join(ROOT, "dist-prerendered");

const PORT = Number(process.env.PRERENDER_PORT || 4173);
const CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY || 4);
const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || "";

if (!BACKEND_URL) {
  console.warn(
    "WARNING: no BACKEND_URL/VITE_BACKEND_URL set -- if the app reads its API base from a build-time " +
    "env var, snapshots may render with no real product data. Check src/context/index.jsx for how the " +
    "API base URL is determined before relying on these snapshots."
  );
}

// Same exclusion list as scripts/generate-sitemap.mjs, for the same reason: course/blogpost are
// DB-driven, not static build-time data, and admin/checkout/journey/searchresults are either
// gated, user-specific, or have no meaningful pre-auth content to freeze.
const EXCLUDED_STATIC_PAGES = new Set([
  "product", "moment", "brewguide", "course", "growingprofile", "country", "growingfactor",
  "admin", "checkout", "journey", "searchresults", "blogpost",
]);

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function buildRouteList() {
  const staticRoutes = Object.keys(PAGE_TO_SLUG)
    .filter((page) => !EXCLUDED_STATIC_PAGES.has(page))
    .map((page) => {
      const slug = PAGE_TO_SLUG[page];
      return { urlPath: slug ? `/${slug}` : "/", outPath: slug || "index" };
    });

  const detailRoutes = [
    ...PRODUCTS.map((p) => ({ urlPath: `/product/${p.id}`, outPath: `product/${p.id}` })),
    ...COUNTRIES.map((c) => ({ urlPath: `/country/${slugify(c.name)}`, outPath: `country/${slugify(c.name)}` })),
    ...MOMENTS.map((m) => ({ urlPath: `/moment/${slugify(m.name)}`, outPath: `moment/${slugify(m.name)}` })),
    ...BREW_GUIDES.map((b) => ({ urlPath: `/brew-guide/${slugify(b.name)}`, outPath: `brew-guide/${slugify(b.name)}` })),
  ];

  return [...staticRoutes, ...detailRoutes];
}

// Minimal static file server for dist/ -- deliberately not vite preview or server.cjs itself:
// this only needs to serve the already-built static assets so the headless browser can load the
// real app, it doesn't need server.cjs's meta-tag injection (irrelevant to what gets captured;
// we capture <body>, not <head>) or Vite's dev-only behavior.
const MIME = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".mp4": "video/mp4" };

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        let filePath = path.join(DIST_DIR, urlPath);
        // SPA fallback, same reasoning as server.cjs's own catch-all: any path without a real
        // file on disk is a client-side route and gets index.html so React can take over.
        try {
          const data = await readFile(filePath);
          res.setHeader("Content-Type", MIME[path.extname(filePath)] || "application/octet-stream");
          res.end(data);
          return;
        } catch {
          const indexHtml = await readFile(path.join(DIST_DIR, "index.html"));
          res.setHeader("Content-Type", "text/html");
          res.end(indexHtml);
        }
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function renderRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  try {
    // Deliberately NOT waitUntil: "networkidle" -- several real pages never reach network-idle
    // within any reasonable timeout: the homepage's autoPlay/loop hero video marquee keeps issuing
    // range-request chunks for as long as the tab is open (that's what a looping <video> actually
    // does over the network), and pages with many externally-hosted images (Unsplash/Cloudinary)
    // can keep triggering lazy-load fetches indefinitely too. "networkidle" waits for the network
    // to go quiet for 500ms straight, which a real, intentionally-never-quiet page will never do --
    // confirmed directly: "/", "/history", and "/world-journey" all timed out on a real prerender
    // run for exactly this reason, not because anything was actually broken.
    //
    // "domcontentloaded" plus the explicit readiness checks below (root has real children, then a
    // bounded settle delay) is the right signal for THIS purpose: we're freezing what a real
    // visitor's browser paints after React finishes its own render passes, not waiting for every
    // possible network request a page might make for its entire lifetime.
    await page.goto(`${baseUrl}${route.urlPath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Wait for the real preload splash to be gone and the SPA root to have real content, not just
    // the empty <div id="root"></div> shell -- gives React time to finish its own data-fetching
    // renders (RouteProvider etc.), not just its first paint.
    await page.waitForSelector("#ma-preload", { state: "detached", timeout: 20000 }).catch(() => {});
    await page.waitForFunction(
      () => document.getElementById("root") && document.getElementById("root").children.length > 0,
      { timeout: 20000 }
    );
    // Settle delay for any final async render (images loading doesn't matter, but a secondary
    // state-driven render pass right after mount does -- e.g. currency conversion or geo-IP
    // finishing after the initial render) -- consistent with this being a best-effort content
    // snapshot, not a byte-perfect final-state capture. Longer than before now that "domcontent
    // loaded" replaces "networkidle" as the initial wait (see above), since that initial wait no
    // longer itself provides any of this settle time.
    await page.waitForTimeout(1500);
    const html = await page.content();
    if (html.includes("error-boundary-screen")) {
      return { ok: false, error: "captured an error-boundary screen instead of real content" };
    }
    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log(`Building dist/ static server on port ${PORT}...`);
  const server = await startStaticServer();
  const baseUrl = `http://localhost:${PORT}`;

  const routes = buildRouteList();
  console.log(`Prerendering ${routes.length} routes (concurrency ${CONCURRENCY})...`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  let ok = 0;
  let failed = 0;

  // Simple concurrency-limited queue -- no extra dependency needed for a one-off build script.
  let idx = 0;
  async function worker() {
    while (idx < routes.length) {
      const route = routes[idx++];
      const result = await renderRoute(browser, baseUrl, route);
      if (!result.ok) {
        failed++;
        console.error(`  FAILED ${route.urlPath}: ${result.error}`);
        continue;
      }
      const outFile = path.join(OUT_DIR, `${route.outPath}.html`);
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, result.html, "utf8");
      ok++;
      console.log(`  ok  ${route.urlPath} -> dist-prerendered/${route.outPath}.html`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, routes.length) }, worker));

  await browser.close();
  server.close();

  console.log(`\nPrerender complete: ${ok} ok, ${failed} failed, out of ${routes.length} routes.`);
  if (failed > 0) {
    console.error(`${failed} route(s) failed to prerender -- see errors above. Their pages will fall back to the plain shell in server.cjs, same as before this change.`);
  }
  // Non-fatal: a partial prerender is still strictly better than none. server.cjs's fallback to
  // the bare shell for any route with no snapshot on disk means a failed route just doesn't
  // regress below where it started.
}

main().catch((err) => {
  console.error("Prerender script crashed:", err);
  process.exit(1);
});
