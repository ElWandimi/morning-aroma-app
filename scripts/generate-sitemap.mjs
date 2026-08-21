// Generates public/sitemap.xml from the real routing data (PAGE_TO_SLUG), so it can never
// silently drift out of sync with the app's actual pages the way a hand-written sitemap would.
// Run manually with: node scripts/generate-sitemap.mjs
//
// NOTE on hash-based URLs: this app uses hash routing (#/shop, not /shop) specifically so it
// works identically via npm run dev, vite preview, AND opening dist/index.html directly via
// file:// (pathname-based history.pushState throws under file://, hash routing doesn't).
// Search engine support for indexing hash-fragment routes in an SPA is real but less reliable
// than true server-rendered paths — if this ever goes to production behind a real domain with
// a real backend, switching to path-based routing (now that a backend can serve index.html for
// any path) would be a meaningful SEO upgrade over this sitemap.
import { PAGE_TO_SLUG } from "../src/data/index.js";
import { writeFileSync } from "fs";

// Replace with the real production domain before deploying.
const SITE_ORIGIN = "https://www.morningaroma.com";

const STATIC_PAGES = Object.keys(PAGE_TO_SLUG).filter(
  (page) => ![
    "product", "moment", "brewguide", "course", "growingprofile", "country", "growingfactor",
    "admin", "checkout", "journey", "searchresults",
  ].includes(page)
);

const urls = STATIC_PAGES.map((page) => {
  const slug = PAGE_TO_SLUG[page];
  const path = slug ? `/#/${slug}` : "/";
  return `  <url>\n    <loc>${SITE_ORIGIN}${path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${page === "home" ? "1.0" : "0.7"}</priority>\n  </url>`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`Wrote public/sitemap.xml with ${STATIC_PAGES.length} URLs`);
