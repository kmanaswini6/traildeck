import { Router } from "express";
import bcryptjs from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { sendError, validationDetails } from "../errors.js";
import {
  SAFE_USER_SELECT,
  dummyCompare,
  loginSchema,
  registerSchema,
  requireAuth,
  signToken,
  toSafeUser,
} from "../auth.js";

const router = Router();

function isUniqueViolation(err) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

// Public registration. Role is always CLIENT, set on the server; any `role`
// in the request body is stripped by the schema and never read.
router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid request body.",
        validationDetails(parsed.error)
      );
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 409, "EMAIL_IN_USE", "Email is already registered.");
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    let user;
    try {
      user = await prisma.user.create({
        data: { name, email, passwordHash, role: "CLIENT" },
        select: SAFE_USER_SELECT,
      });
    } catch (err) {
      // Race: two requests passed the pre-check; the unique index wins.
      if (isUniqueViolation(err)) {
        return sendError(
          res,
          409,
          "EMAIL_IN_USE",
          "Email is already registered."
        );
      }
      throw err;
    }

    return res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid request body.",
        validationDetails(parsed.error)
      );
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Same work as a real check: timing must not reveal unknown emails.
      await dummyCompare();
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password."
      );
    }

    const ok = await bcryptjs.compare(password, user.passwordHash);
    if (!ok) {
      return sendError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password."
      );
    }

    const safeUser = toSafeUser(user);
    return res.status(200).json({ user: safeUser, token: signToken(user) });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
    }
    return res.status(200).json({ user });
  } catch (err) {
    return next(err);
  }
});

export default router;
