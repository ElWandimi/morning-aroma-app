import { BREW_GUIDES, COUNTRIES, COURSES, MOMENTS } from "../data";

// Client-side CSV export — no new dependency needed. Escapes values containing a comma, quote,
// or newline per the standard CSV quoting rule, then triggers a download via a Blob + a
// programmatically-clicked anchor (the standard no-backend way to produce a downloadable file).
export function exportToCSV(filename, headers, rows) {
  const escape = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Every one of the original 9 products has a real, uploaded bag photo at this fixed path. A
// custom product added through the admin dashboard has no such photo by default -- rather than
// let it render a broken/blank image, fall back to that origin's real landscape photography
// (which always exists, since the "add product" form restricts country to the existing origin
// list) unless admin has uploaded a real photo for it (photoUrl, a data URL stored on the
// product itself).
// The original 9 products shipped with real, bundled photo files at /photos/products/<id>.png.
// Any product beyond these (admin-added, before or after products became a real database table)
// has no such bundled file, so needs the country-landscape fallback instead -- this used to be
// tracked via an explicit isCustom flag on each product object, which no longer exists once every
// product is a uniform row from the real backend. This fixed list is the actual, stable thing
// that distinguishes them: which files really exist in this repo, not a flag on the data.
const PRODUCTS_WITH_BUNDLED_PHOTOS = [
  "geisha-panama", "laurina-brazil", "sl28-kenya", "pacamara-elsalvador", "bourbon-rwanda",
  "typica-guatemala", "caturra-colombia", "catuai-honduras", "yirgacheffe-ethiopia",
];
// Real Cloudinary format+quality auto-optimization, applied here so every existing call site
// benefits automatically -- confirmed via Cloudinary's own current documentation that f_auto/q_auto
// (forward-slash separated) is the correct, current syntax, not the comma-separated form seen in
// most older examples online. A country-fallback or bundled static photo isn't a Cloudinary URL at
// all, so this only ever touches a URL that's actually real Cloudinary content.
function withCloudinaryOptimization(url) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/f_auto/q_auto/");
}

// Real, targeted resizing for both Unsplash and Cloudinary URLs -- found via a direct user report
// that small, ~100-260px-tall product-grid cards were requesting the full 1600px-wide source image
// (confirmed against the actual CSS: a 5-7x dimensional over-fetch, ~25-50x in actual bytes). Only
// ever narrows an existing size, never used to make an image larger than its real source, and only
// touches URLs from these two known services -- a bundled static photo passes through unchanged.
export function withTargetWidth(url, targetWidth) {
  if (!url || !targetWidth) return url;
  if (url.includes("images.unsplash.com")) {
    return url.includes("w=") ? url.replace(/w=\d+/, `w=${targetWidth}`) : `${url}&w=${targetWidth}`;
  }
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/w_${targetWidth}/`);
  }
  return url;
}

// targetWidth is optional and deliberately opt-in -- omitting it keeps every existing call site's
// behavior exactly as it was, so this can be adopted gradually at each real display context's own
// actual size, rather than a single global change risking degraded quality somewhere it wasn't
// tested (e.g. WorldJourney.jsx's full-bleed hero background, which genuinely needs the full size
// and is deliberately left untouched).
export const getProductPhotoUrl = (p, countryPhotoMap, targetWidth) => {
  if (p.photoUrl) return withTargetWidth(withCloudinaryOptimization(p.photoUrl), targetWidth);
  if (PRODUCTS_WITH_BUNDLED_PHOTOS.includes(p.id)) return `/photos/products/${p.id}.png`;
  return withTargetWidth(countryPhotoMap[p.country], targetWidth);
};

// Reads an uploaded image file, downscales it on a canvas to a sensible max width (matching the
// size the rest of the product photos are already served at), and resolves to a JPEG data URL --
// entirely client-side, no server/upload endpoint needed. Rejects anything that isn't an image
// or is implausibly large before doing any work.
export function resizeImageFile(file, maxWidth = 700) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error("That image is too large (12MB max).")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't load that image."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const storage = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable or full — fail silently, in-memory state still works */
    }
  },
};

// Real page-view tracking, scoped honestly to what's actually measurable without a backend: views
// from this browser only, not aggregate site traffic across every visitor (that needs a real
// analytics service or server-side logging). Bucketed by day and page type in localStorage, same
// consent gate as cart/wishlist persistence -- this is tracking data like any other, not exempt
// from the site's own privacy consent just because it's for the admin's benefit.
export function logPageView(page) {
  if (getStorageConsent() !== "accepted") return;
  const today = new Date().toISOString().slice(0, 10);
  const data = storage.get("ma_pageviews", {});
  if (!data[today]) data[today] = {};
  data[today][page] = (data[today][page] || 0) + 1;
  storage.set("ma_pageviews", data);
}

export const nameFromEmail = (email) => {
  const handle = email.split("@")[0].replace(/[._-]+/g, " ");
  return handle.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const fmtPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// A non-interactive element (a <div>) used as a click target for navigation has no built-in
// keyboard support at all -- no tab stop, no Enter/Space activation, unlike a real <button> or
// <a>. This is the standard, established WCAG pattern for making one operable without changing
// its element type: add tabIndex={0} and role="button" (or "link") directly on the element, plus
// this onKeyDown handler, which fires the same callback the onClick already does. preventDefault
// on Space specifically matters -- without it, the browser's default behavior is to scroll the
// page, which is not what a keyboard user activating a card expects to happen.
export function activateOnEnterOrSpace(callback) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback(e);
    }
  };
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return { hit: false };
  if (t.includes(q)) return { hit: true, exact: true };
  if (q.length < 3) return { hit: false };
  const tolerance = q.length <= 5 ? 1 : 2;
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const closest = Math.min(...words.map((w) => levenshtein(w, q)), Infinity);
  return { hit: closest <= tolerance, exact: false };
}

// Shared site-wide search — used by both the quick-search modal (which shows a capped preview)
// and the full search results page, so the matching logic only lives in one place. Returns
// {type, label, page, params, exact} rather than baking in a go() callback, since the two callers
// navigate slightly differently (the modal also needs to close itself first).
export function searchSite(query, allProducts) {
  const q = query.trim();
  if (!q) return [];
  let results = [];
  const push = (fields, entry) => {
    const matches = fields.map((f) => fuzzyMatch(f, q));
    const hit = matches.find((m) => m.hit);
    if (hit) results.push({ ...entry, exact: hit.exact });
  };
  allProducts.forEach((p) => {
    push([p.name, p.country, p.note], { type: "Variety", label: `${p.name} — ${p.country}`, page: "product", params: { id: p.id } });
  });
  MOMENTS.forEach((m) => {
    push([m.name], { type: "Moment", label: m.name, page: "moment", params: { id: m.id } });
  });
  COURSES.forEach((c) => {
    push([c.name], { type: "Course", label: c.name, page: "course", params: { id: slugify(c.name) } });
  });
  BREW_GUIDES.forEach((b) => {
    push([b.name], { type: "Brew Guide", label: b.name, page: "brewguide", params: { id: slugify(b.name) } });
  });
  COUNTRIES.forEach((c) => {
    push([c.name], { type: "Origin", label: c.name, page: "country", params: { id: slugify(c.name) } });
  });
  return results.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0));
}

export function lerpColor(hexA, hexB, t) {
  const a = hexA.match(/\w\w/g).map((h) => parseInt(h, 16));
  const b = hexB.match(/\w\w/g).map((h) => parseInt(h, 16));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Cookie/local-storage consent — storing the preference itself is "strictly necessary" storage
// under most privacy frameworks (remembering someone's own consent choice is the textbook
// exemption), so this one write is always allowed regardless of the choice made.
export function getStorageConsent() {
  try {
    return window.localStorage.getItem("ma_consent"); // "accepted" | "declined" | null (undecided)
  } catch {
    return null;
  }
}
export function setStorageConsent(value) {
  try {
    window.localStorage.setItem("ma_consent", value);
  } catch {
    /* storage unavailable — consent banner will just reappear next visit, harmless */
  }
}

// Loads Paystack's real InlineJS v2 script on demand -- only when someone actually reaches a real
// payment step, not on every page load site-wide. Safe to call more than once; only loads the
// script the first time, since window.PaystackPop existing already means it's already loaded.
// Shared between Checkout (cart/order payments) and Academy (course subscriptions, lifetime
// access) rather than duplicated in both.
export function loadPaystackScript() {
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Paystack. Check your connection and try again."));
    document.body.appendChild(script);
  });
}
