const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");
const productsRoutes = require("./routes/products");
const greenBeansRoutes = require("./routes/greenBeans");
const webhooksRoutes = require("./routes/webhooks");

const app = express();

app.get("/health", (req, res) => res.json({ ok: true }));

// Mounted with express.raw(), and BEFORE the global express.json() below -- Paystack's webhook
// signature is an HMAC over the exact raw request body. If express.json() ran first, it would
// consume and parse that body before this route ever saw the original bytes, making a correct
// signature comparison impossible (see routes/webhooks.js for the full explanation). Doesn't need
// CORS either, unlike everything below it -- Paystack calls this server-to-server, not from a
// browser, so CORS (a browser-enforced mechanism) simply doesn't apply here.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRoutes);

app.use(express.json());

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
