import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initSentry } from "./utils/sentry.js";
import { getStorageConsent } from "./utils/helpers.js";

// A returning visitor who already accepted on a previous visit shouldn't have to accept again --
// ma_consent persists in local storage, so this covers that case. A first-time visitor is covered
// separately, the moment they click "Accept" in ConsentBanner itself (see components/index.jsx).
if (getStorageConsent() === "accepted") initSentry();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
