import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initSentry } from "./utils/sentry.js";
import { loadGtagScript, enableGA } from "./utils/analytics.js";
import { getStorageConsent } from "./utils/helpers.js";

// loadGtagScript() runs unconditionally, regardless of consent -- see analytics.js's own top
// comment for the full real reasoning (Google's own tag checker couldn't detect the script at
// all when it only ever loaded behind a consent gate, and Consent Mode v2's default-denied state
// keeps this genuinely inert -- no cookies, no data sent -- until enableGA() is actually called).
// enableGA() itself stays consent-gated: only called here for a RETURNING visitor whose consent
// was already accepted on a previous visit; a first-time visitor gets it from ConsentBanner's own
// "Accept" click instead (see components/index.jsx). initSentry() keeps its own, separate,
// unchanged consent gate -- Sentry has no equivalent "load inert, activate later" mode, and
// nothing about it needed Google's tag checker to work.
// Wrapped defensively: error-monitoring/analytics setup must never be able to prevent the app
// itself from mounting -- if any of these throw for any reason, the site should still render
// normally.
try {
  loadGtagScript();
  if (getStorageConsent() === "accepted") { initSentry(); enableGA(); }
} catch (e) {
  console.error("Sentry/GA init failed (non-fatal):", e);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
