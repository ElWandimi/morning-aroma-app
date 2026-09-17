require("dotenv").config();
const app = require("./app");
const { startAbandonedCartJob } = require("./utils/abandonedCartJob");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Morning Aroma auth server listening on port ${PORT}`);
});

// Started here, not in app.js -- app.js is imported directly by the real backend test suite
// (test/run-e2e.js) without ever calling listen(), and a real 15-minute setInterval running
// during every test run would be genuine, unnecessary background work a test process has no use
// for. index.js only ever runs as the real, actual production/dev server.
startAbandonedCartJob();
