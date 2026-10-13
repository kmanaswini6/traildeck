import dotenv from "dotenv";
import { app } from "./app.js";
import { getJwtSecret } from "./auth.js";

dotenv.config();

// Fail fast at startup when the signing secret is missing. No fallback.
getJwtSecret();

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`TrailDeck server listening on port ${port}`);
});
