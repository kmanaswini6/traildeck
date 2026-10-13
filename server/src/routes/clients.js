import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { sendError, validationDetails } from "../errors.js";
import { requireAuth, requireRole } from "../auth.js";
import { toOrderBy, toPageMeta } from "../pagination.js";
import {
  CLIENT_SELECT,
  clientIdParam,
  clientListSchema,
  clientProfileSelect,
  createClientSchema,
  patchClientSchema,
} from "../clients.js";

const router = Router();

// Lawyer-only: every route on this router requires authentication plus the
// LAWYER role. lawyerId always comes from req.userId (the verified token).
router.use(requireAuth, requireRole("LAWYER"));

function isKnownError(err, code) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === code
  );
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid request body.",
        validationDetails(parsed.error)
      );
    }
    const { name, email, phone } = parsed.data;
    const client = await prisma.client.create({
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        lawyerId: req.userId,
      },
      select: CLIENT_SELECT,
    });
    return res.status(201).json({ client });
  } catch (err) {
    return next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const parsed = clientListSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters.",
        validationDetails(parsed.error)
      );
    }
    const { page, pageSize, q, sortBy, order, hasCases } = parsed.data;

    // lawyerId stays at the TOP level; search goes in a separate OR array
    // so it can only narrow, never widen, the lawyer scope.
    const where = { lawyerId: req.userId };
    if (q) {
      const contains = { contains: q, mode: "insensitive" };
      where.OR = [{ name: contains }, { email: contains }, { phone: contains }];
    }
    if (hasCases !== undefined) {
      where.cases = hasCases === "true" ? { some: {} } : { none: {} };
    }

    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: toOrderBy(sortBy, order),
        skip,
        take: pageSize,
        select: CLIENT_SELECT,
      }),
      prisma.client.count({ where }),
    ]);
    return res.status(200).json({ data: rows, ...toPageMeta(page, pageSize, total) });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = clientIdParam.safeParse(req.params.id);
    if (!id.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid client id.",
        validationDetails(id.error)
      );
    }
    const client = await prisma.client.findFirst({
      where: { id: id.data, lawyerId: req.userId },
      select: clientProfileSelect(req.userId),
    });
    if (!client) {
      return sendError(res, 404, "NOT_FOUND", "Client not found.");
    }
    return res.status(200).json({ client });
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = clientIdParam.safeParse(req.params.id);
    if (!id.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid client id.",
        validationDetails(id.error)
      );
    }
    const parsed = patchClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid request body.",
        validationDetails(parsed.error)
      );
    }
    // Only defined keys are written: null clears email/phone, omitted
    // leaves the column untouched. Unknown keys were already stripped.
    const data = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.email !== undefined) data.email = parsed.data.email;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;

    try {
      const client = await prisma.client.update({
        where: { id: id.data, lawyerId: req.userId },
        data,
        select: CLIENT_SELECT,
      });
      return res.status(200).json({ client });
    } catch (err) {
      // No record matched the scoped id: missing or another lawyer's.
      if (isKnownError(err, "P2025")) {
        return sendError(res, 404, "NOT_FOUND", "Client not found.");
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = clientIdParam.safeParse(req.params.id);
    if (!id.success) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid client id.",
        validationDetails(id.error)
      );
    }
    try {
      await prisma.client.delete({
        where: { id: id.data, lawyerId: req.userId },
        select: { id: true },
      });
      return res.status(204).end();
    } catch (err) {
      if (isKnownError(err, "P2025")) {
        return sendError(res, 404, "NOT_FOUND", "Client not found.");
      }
      // Restrict FK: the client still has cases. Never cascade.
      if (isKnownError(err, "P2003")) {
        return sendError(
          res,
          409,
          "CLIENT_HAS_CASES",
          "Client cannot be deleted while cases exist."
        );
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

export default router;
