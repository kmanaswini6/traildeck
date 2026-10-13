import { z } from "zod";

// Shared list-query parsing for lawyer-scoped list endpoints (clients now,
// cases later). Callers pass their own sort allowlist and defaults; unknown
// query params are stripped by the schema and ignored.
export function listQuerySchema({ sortFields, defaultSortBy, defaultOrder = "desc" }) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    sortBy: z.enum(sortFields).default(defaultSortBy),
    order: z.enum(["asc", "desc"]).default(defaultOrder),
  });
}

// Deterministic ordering: requested sort plus an id tie-breaker so pages
// are stable.
export function toOrderBy(sortBy, order) {
  return [{ [sortBy]: order }, { id: "asc" }];
}

export function toPageMeta(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
