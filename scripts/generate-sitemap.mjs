// Generates public/sitemap.xml from the real routing data (PAGE_TO_SLUG), so it can never
// silently drift out of sync with the app's actual pages the way a hand-written sitemap would.
// Run manually with: node scripts/generate-sitemap.mjs
//
// Real path-based URLs (/shop, not #/shop) -- this app switched off hash routing specifically
// because a browser never sends the part of a URL after '#' in an HTTP request at all, meaning
// search engines could never reliably index hash-fragment routes the way they can real paths.
// See ROADMAP.md's change log for the full detail.
import { PAGE_TO_SLUG } from "../src/data/index.js";
import { writeFileSync } from "fs";

// SITE_ORIGIN env var lets this reflect the real deployed domain without editing this file by
// hand -- falls back to the actual current Railway domain (not a domain the project owner
// doesn't own) if unset, same reasoning already applied to FRONTEND_URL in the backend's email
// links: never hardcode a domain that isn't genuinely real and controlled by this project.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://morning-aroma-app-production.up.railway.app";

const STATIC_PAGES = Object.keys(PAGE_TO_SLUG).filter(
  (page) => ![
    "product", "moment", "brewguide", "course", "growingprofile", "country", "growingfactor",
    "admin", "checkout", "journey", "searchresults",
  ].includes(page)
);

const urls = STATIC_PAGES.map((page) => {
  const slug = PAGE_TO_SLUG[page];
  const path = slug ? `/${slug}` : "/";
  return `  <url>\n    <loc>${SITE_ORIGIN}${path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${page === "home" ? "1.0" : "0.7"}</priority>\n  </url>`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`Wrote public/sitemap.xml with ${STATIC_PAGES.length} URLs`);
