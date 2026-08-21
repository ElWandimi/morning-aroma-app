require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Morning Aroma auth server listening on port ${PORT}`);
});
