const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");
const productsRoutes = require("./routes/products");
const greenBeansRoutes = require("./routes/greenBeans");
const settingsRoutes = require("./routes/settings");
const subscriptionsRoutes = require("./routes/subscriptions");
const coursesRoutes = require("./routes/courses");
const feedbackRoutes = require("./routes/feedback");
const webhooksRoutes = require("./routes/webhooks");

const app = express();

// Railway (like most PaaS platforms) sits its own reverse proxy in front of this server -- every
// real request arrives with the actual visitor's IP in the X-Forwarded-For header, not as the
// direct TCP connection, which Express's default `req.ip` would otherwise report as Railway's own
// internal proxy address. Without this, every single visitor resolves to the SAME `req.ip` --
// meaning the auth rate limiter below (server/src/routes/auth.js) was, until this fix, sharing its
// 20-requests-per-15-minutes production limit across ALL real visitors combined, not scoped to
// each individual one. A real fairness bug: enough simultaneous legitimate traffic could lock out
// innocent visitors who'd made nowhere near 20 requests themselves. `1` tells Express to trust
// exactly one hop of reverse proxy, matching Railway's architecture -- not `true`, which would
// trust the header from anywhere, letting a client spoof their own IP to bypass rate limiting
// entirely (this exact distinction is what express-rate-limit's own ERR_ERL_PERMISSIVE_TRUST_PROXY
// check exists to catch, if this were ever set too permissively instead of not set at all).
app.set("trust proxy", 1);

app.get("/health", (req, res) => res.json({ ok: true }));

// Mounted with express.raw(), and BEFORE the global express.json() below -- Paystack's webhook
// signature is an HMAC over the exact raw request body. If express.json() ran first, it would
// consume and parse that body before this route ever saw the original bytes, making a correct
// signature comparison impossible (see routes/webhooks.js for the full explanation). Doesn't need
// CORS either, unlike everything below it -- Paystack calls this server-to-server, not from a
// browser, so CORS (a browser-enforced mechanism) simply doesn't apply here.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRoutes);

// Default limit (100kb) is too small for the base64-encoded product photos admin uploads send
// (src/utils/helpers.js's resizeImageFile caps at 700px wide, JPEG quality 0.85, which can still
// realistically produce 100-300kb+ once base64-encoded, depending on image detail) -- a real,
// pre-existing bug that would have silently rejected a normal photo upload with a 413 before it
// ever reached a route handler, unrelated to anything about where the resulting URL gets stored.
// 5mb is generous headroom for a single resized image without being unbounded.
app.use(express.json({ limit: "5mb" }));

// Allows the deployed frontend's origin (and localhost during development) to call this API from
// the browser. Set FRONTEND_URL in the environment once the frontend's real Railway domain is
// known; without it, only localhost works, which is safe-by-default rather than accidentally
// open-by-default.
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/orders", ordersRoutes);
app.use("/products", productsRoutes);
app.use("/green-beans", greenBeansRoutes);
app.use("/settings", settingsRoutes);
app.use("/subscriptions", subscriptionsRoutes);
app.use("/courses", coursesRoutes);
app.use("/feedback", feedbackRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected promises from async route handlers here automatically -- confirmed
// directly rather than assumed, since this project's Express 4 knowledge (the far more common
// version, where this would NOT happen automatically) doesn't apply to what npm actually installed.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

module.exports = app;
