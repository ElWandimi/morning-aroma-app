const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();

app.use(express.json());

// Allows the deployed frontend's origin (and localhost during development) to call this API from
// the browser. Set FRONTEND_URL in the environment once the frontend's real Railway domain is
// known; without it, only localhost works, which is safe-by-default rather than accidentally
// open-by-default.
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);

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
