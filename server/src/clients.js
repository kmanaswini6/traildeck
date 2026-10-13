import { z } from "zod";
import { listQuerySchema } from "./pagination.js";

// Explicit field selection for client responses. lawyerId and userId are
// never returned.
export const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
};

// Profile select: safe fields plus case history through the existing
// Client–Case relation, scoped to the same lawyer.
export function clientProfileSelect(lawyerId) {
  return {
    ...CLIENT_SELECT,
    cases: {
      where: { lawyerId },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        status: true,
        court: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    },
  };
}

export const clientIdParam = z.string().uuid();

const PHONE_PATTERN = /^[0-9+\-() ]+$/;

// Omitted, null, or empty string all mean "no value" (stored as null).
// Only "" is normalized here; null/undefined pass through to .nullish().
const emptyToNull = (v) => (v === "" ? null : v);

const emailField = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().max(254).email().nullish()
);

const phoneField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(20)
    .regex(PHONE_PATTERN, "Invalid phone number.")
    .min(5)
    .nullish()
);

// Write bodies pick only name/email/phone. Unknown keys (lawyerId, userId,
// id, createdAt, ...) are stripped and never read.
export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailField,
  phone: phoneField,
});

export const patchClientSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: emailField,
    phone: phoneField,
  })
  .refine(
    (d) =>
      d.name !== undefined || d.email !== undefined || d.phone !== undefined,
    { message: "Provide at least one of name, email, or phone." }
  );

export const clientListSchema = listQuerySchema({
  sortFields: ["name", "createdAt", "updatedAt"],
  defaultSortBy: "createdAt",
  defaultOrder: "desc",
}).extend({
  hasCases: z.enum(["true", "false"]).optional(),
});
