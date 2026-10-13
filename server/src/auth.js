import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { sendError } from "./errors.js";

// Fields a client is ever allowed to see. Selected explicitly everywhere;
// the password hash is never read into responses.
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

const emailField = z.string().trim().toLowerCase().max(254).email();

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailField,
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected.
  password: z.string().min(8).max(72),
  // NOTE: any `role` key in the body is stripped here and never read.
  // Public registration always creates role CLIENT (see routes/auth.js).
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

// Fixed hash for the unknown-email login path: comparing against it keeps
// response timing from revealing whether an email is registered.
const DUMMY_HASH =
  "$2b$10$PHJ1JyKwptVpbqKweBPLL.wiesbakH4xCzI/j9PVlmQe1zTPThl8G";

export async function dummyCompare() {
  await bcryptjs.compare("traildeck-dummy-password-for-timing", DUMMY_HASH);
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Add it to server/.env (see server/.env.example)."
    );
  }
  return secret;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
}

// Reads Authorization: Bearer <token>, verifies it, and sets req.userId /
// req.userRole from the token only. Exported for reuse by later tasks.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
  }
  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return sendError(res, 401, "TOKEN_EXPIRED", "Token has expired.");
    }
    return sendError(res, 401, "INVALID_TOKEN", "Invalid token.");
  }
  req.userId = decoded.sub;
  req.userRole = decoded.role;
  return next();
}
