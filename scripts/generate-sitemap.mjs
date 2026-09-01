// Generates public/sitemap.xml from the real routing data, so it can never silently drift out of
// sync with the app's actual pages and content the way a hand-written sitemap would. Runs
// automatically as part of `npm run build` -- was previously a real, if only intended, mechanism
// that was never actually wired in, so it silently never ran; that, combined with defaulting to
// the Railway staging domain rather than the real production one, is exactly why the sitemap that
// shipped pointed at the wrong domain entirely and never listed a single product, country,
// moment, or brew-guide page.
//
// Real path-based URLs (/shop, not #/shop) -- this app switched off hash routing specifically
// because a browser never sends the part of a URL after '#' in an HTTP request at all, meaning
// search engines could never reliably index hash-fragment routes the way they can real paths.
// See ROADMAP.md's change log for the full detail.
import { PAGE_TO_SLUG, PRODUCTS, COUNTRIES, MOMENTS, BREW_GUIDES } from "../src/data/index.js";
import { writeFileSync } from "fs";

// SITE_ORIGIN env var lets this reflect the real deployed domain without editing this file by
// hand -- falls back to the actual, real, live production domain (not the Railway staging URL
// this previously, incorrectly fell back to) if unset, same reasoning already applied to
// FRONTEND_URL in the backend's email links: never hardcode a domain that isn't genuinely real
// and controlled by this project.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://morning-aroma.com";
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// course/growingprofile/growingfactor stay excluded here, not an oversight -- courses now live in
// the real database (see ROADMAP.md), not static data this build-time script can read directly
// without adding a real network dependency to every build, and growingprofile/growingfactor are
// product-specific sub-pages whose real content already lives on the product page itself.
const STATIC_PAGES = Object.keys(PAGE_TO_SLUG).filter(
  (page) => ![
    "product", "moment", "brewguide", "course", "growingprofile", "country", "growingfactor",
    "admin", "checkout", "journey", "searchresults",
  ].includes(page)
);

const staticUrls = STATIC_PAGES.map((page) => {
  const slug = PAGE_TO_SLUG[page];
  const path = slug ? `/${slug}` : "/";
  return { loc: `${SITE_ORIGIN}${path}`, priority: page === "home" ? "1.0" : "0.7" };
});

// Real, individual detail pages -- the previous sitemap never had any of these at all, only
// static hub pages, meaning it never actually helped a search engine discover this site's real
// content: any of its 15 products, 15 countries, 8 coffee moments, or 14 brew guides.
const detailUrls = [
  ...PRODUCTS.map((p) => ({ loc: `${SITE_ORIGIN}/product/${p.id}`, priority: "0.8" })),
  ...COUNTRIES.map((c) => ({ loc: `${SITE_ORIGIN}/country/${slugify(c.name)}`, priority: "0.6" })),
  ...MOMENTS.map((m) => ({ loc: `${SITE_ORIGIN}/moment/${slugify(m.name)}`, priority: "0.5" })),
  ...BREW_GUIDES.map((b) => ({ loc: `${SITE_ORIGIN}/brew-guide/${slugify(b.name)}`, priority: "0.5" })),
];

const allUrls = [...staticUrls, ...detailUrls];
const urlsXml = allUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`Wrote public/sitemap.xml with ${allUrls.length} real URLs (${STATIC_PAGES.length} static, ${PRODUCTS.length} products, ${COUNTRIES.length} countries, ${MOMENTS.length} moments, ${BREW_GUIDES.length} brew guides)`);
