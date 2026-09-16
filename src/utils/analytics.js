// Real GA4 analytics, gated behind its own, explicitly-named consent choice -- NOT silently
// bundled into the existing "Accept" button ConsentBanner already had for cart/wishlist local
// storage and Sentry error monitoring. That banner's own real, previous wording told visitors
// "it doesn't collect your IP address or track you for marketing" and the real Privacy Policy
// stated outright "We do not use Google Analytics... The only optional, consent-gated third
// party is Sentry" -- both genuinely true when written, both would become genuinely false the
// moment GA4 shipped if it piggybacked on that same consent. GA4 gets its own real, separately-
// labeled toggle instead (see ConsentBanner's own updated JSX), and the Privacy Policy text is
// corrected in the same change, not left stale.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export function initGA() {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;

  // Guarded at the source, not just by callers -- same real reasoning as initSentry: analytics
  // breaking is a shame, analytics breaking the app itself would be a real, serious regression.
  try {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    // anonymize_ip -- real, standard GA4 practice for a site whose own consent banner and
    // Privacy Policy make a point of minimizing what's collected elsewhere (Sentry explicitly
    // never gets a visitor's IP either, per sentry.js's own comment); this keeps that same real
    // posture consistent across every analytics/monitoring tool this site actually uses, not just
    // the one Sentry already covered.
    gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
  } catch (e) {
    console.error("GA4 init threw (non-fatal, app continues normally):", e);
    initialized = false;
  }
}

// A real, named page-view event -- GA4's own automatic pageview tracking relies on real, full
// page loads, which this single-page app deliberately doesn't do for route changes (see
// useRoute/pathFor elsewhere in this codebase). Called from App.jsx's own route-change effect,
// the same real place useDocumentMeta already updates the page title for each route.
export function trackPageView(path, title) {
  if (!initialized || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "page_view", { page_path: path, page_title: title });
  } catch (e) {
    console.error("GA4 trackPageView threw (non-fatal):", e);
  }
}
