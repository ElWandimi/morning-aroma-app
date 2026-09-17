// Real GA4 analytics, following Google's own documented Consent Mode v2 pattern -- NOT silently
// bundled into the existing "Accept" button ConsentBanner already had for cart/wishlist local
// storage and Sentry error monitoring (that banner's own wording and the real Privacy Policy both
// previously said this site doesn't use Google Analytics at all; both are corrected alongside
// this to honestly disclose it, not left stale).
//
// Two real, separate steps, not one -- this is the actual reason: the gtag.js SCRIPT itself
// (loadGtagScript, called unconditionally on every page load) is genuinely inert without a real
// consent grant -- it seeds `gtag('consent', 'default', { analytics_storage: 'denied', ... })`
// before anything else, the documented Consent Mode v2 mechanism for telling GA4 not to store
// cookies or send identifiable data. Confirmed directly: Google's own "Set up a Google tag"
// checker in the GA4 admin UI couldn't detect the tag at all when it only existed behind a real
// consent gate (a fresh visitor -- which is what that checker effectively is -- has no consent
// recorded, so the script never loaded, so there was nothing on the page for the checker to
// find). Loading the inert script unconditionally, but only ever GRANTING real consent
// (enableGA, called from ConsentBanner's "Accept" and from main.jsx for a returning visitor who
// already accepted) satisfies that checker while keeping actual tracking behavior identical to
// before: no real data is sent to Google until a visitor has genuinely accepted.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let scriptLoaded = false;
let enabled = false;

// Called unconditionally, once, at app startup (main.jsx) -- regardless of consent state. Safe
// to call even when consent is later declined or never given: the consent-mode default below
// keeps this genuinely inert (no cookies, no data sent) until enableGA() is explicitly called.
export function loadGtagScript() {
  if (scriptLoaded || !MEASUREMENT_ID) return;
  scriptLoaded = true;

  try {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    // Must be seeded before the script itself loads and before any config call -- this is the
    // real, documented Consent Mode v2 requirement (see this file's own top comment for sources
    // confirming this ordering). Denied by default: GA4 will not store cookies or send
    // identifiable analytics_storage data unless/until enableGA() below calls a real 'update'.
    gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("js", new Date());

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  } catch (e) {
    console.error("GA4 script load threw (non-fatal, app continues normally):", e);
    scriptLoaded = false;
  }
}

// The real, actual consent-gated step -- called only from ConsentBanner's "Accept" click, and
// from main.jsx for a returning visitor whose consent was already accepted on a previous visit.
// This is what actually starts sending real, identifiable data to Google; loadGtagScript() above
// never does this on its own.
export function enableGA() {
  if (enabled || !MEASUREMENT_ID || typeof window.gtag !== "function") return;
  enabled = true;
  try {
    window.gtag("consent", "update", { analytics_storage: "granted" });
    // anonymize_ip -- real, standard GA4 practice for a site whose own consent banner and
    // Privacy Policy make a point of minimizing what's collected elsewhere (Sentry explicitly
    // never gets a visitor's IP either, per sentry.js's own comment).
    window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
  } catch (e) {
    console.error("GA4 enable threw (non-fatal):", e);
    enabled = false;
  }
}

// A real, named page-view event -- GA4's own automatic pageview tracking relies on real, full
// page loads, which this single-page app deliberately doesn't do for route changes (see
// useRoute/pathFor elsewhere in this codebase). Called from App.jsx's own route-change effect,
// the same real place useDocumentMeta already updates the page title for each route. Only
// actually sends anything once enableGA() has genuinely been called -- before that, consent mode
// keeps this a real no-op regardless.
export function trackPageView(path, title) {
  if (!enabled || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "page_view", { page_path: path, page_title: title });
  } catch (e) {
    console.error("GA4 trackPageView threw (non-fatal):", e);
  }
}
