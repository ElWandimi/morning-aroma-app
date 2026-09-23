// @sentry/react is now dynamically imported inside initSentry() below, rather than statically at
// the top of this file -- this file itself is statically imported by main.jsx (app startup), so a
// static Sentry import here meant the entire Sentry SDK was bundled into the very first chunk
// every visitor downloads, even one who hasn't accepted the consent banner yet and so never
// actually calls initSentry() at all. A dynamic import() only pulls that code in -- as its own,
// separate chunk -- for a visitor who's actually accepted, which given the consent gate below is
// most real visitors eventually, but no longer blocks anyone's very first paint on downloading it.
//
// Real error monitoring, gated behind the same consent the ConsentBanner already collects for
// cart/wishlist local storage -- Sentry receives the visitor's IP address and browser info by
// default (see sendDefaultPii below, explicitly left false), which is tracking-adjacent data no
// different in kind from analytics, so it doesn't get a free pass just because it's for our own
// bug-fixing rather than marketing. Only ever initialized after explicit "accept", same as every
// other non-essential thing gated by ma_consent.
const DSN = import.meta.env.VITE_SENTRY_DSN;

let initialized = false;
// Holds the real Sentry module once loaded, so reportError() below (which can fire long after
// initSentry() resolves) doesn't need its own separate dynamic import.
let SentryModule = null;

export async function initSentry() {
  if (initialized || !DSN) return;
  initialized = true;

  // Guarded at the source, not just by callers -- this function must never be able to throw and
  // take down whatever called it (app startup in main.jsx, a click handler in ConsentBanner).
  // Error monitoring breaking is a shame; error monitoring breaking the app itself is a genuinely
  // serious regression, and a real one this project shipped once already.
  try {
    const Sentry = await import("@sentry/react");
    SentryModule = Sentry;
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.PROD ? "production" : "development",
      // No IP address, cookies, or request headers attached to events by default -- this is error
      // monitoring for us to fix bugs, not a visitor-tracking profile. Sentry's own default here is
      // already false; set explicitly so a future SDK version changing its default doesn't silently
      // change what we send.
      sendDefaultPii: false,
      // Tracing and Session Replay were both left off when the Sentry project was created (see the
      // project setup toggles) -- 0 here matches that choice and keeps this to what it says on the
      // tin: error monitoring only, not a broader observability platform.
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Strips anything that looks like it could be a real customer's data out of error reports
      // before they ever leave the browser -- an error thrown while typing an email into checkout,
      // for instance, shouldn't put that email in our error dashboard.
      beforeSend(event) {
        const scrub = (value) =>
          typeof value === "string"
            ? value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[redacted-email]")
            : value;
        if (event.message) event.message = scrub(event.message);
        event.exception?.values?.forEach((v) => {
          if (v.value) v.value = scrub(v.value);
        });
        return event;
      },
    });
  } catch (e) {
    console.error("Sentry.init threw (non-fatal, app continues normally):", e);
  }
}

export function reportError(error, extra) {
  // Not just !initialized -- initSentry() is now async (it awaits the dynamic import), so there's
  // a real, reachable window where initialized is about to become true but SentryModule hasn't
  // landed yet. Both guards together mean a genuinely-not-ready call is silently skipped rather
  // than throwing on a null SentryModule.captureException.
  if (!initialized || !SentryModule) return;
  try {
    SentryModule.captureException(error, extra ? { extra } : undefined);
  } catch (e) {
    console.error("Sentry.captureException threw (non-fatal):", e);
  }
}
