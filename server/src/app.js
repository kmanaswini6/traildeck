import express from "express";
import { sendError } from "./errors.js";
import authRouter from "./routes/auth.js";

// The app is exported without listening so Supertest can test it in-process.
export const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);

app.use((req, res) => {
  sendError(res, 404, "NOT_FOUND", "Route not found.");
});

// Central error handler: malformed JSON bodies become a 400 in the standard
// shape; unexpected failures become a generic 500 with no stack trace and
// no database error text.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return sendError(res, 400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong.");
});
