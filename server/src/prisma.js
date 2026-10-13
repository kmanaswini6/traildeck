import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. All route modules import { prisma } from here
// so tests can mock this one module instead of touching a real database.
export const prisma = new PrismaClient();
