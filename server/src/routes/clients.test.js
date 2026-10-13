import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake secret for tests only. Never the real .env value. Read lazily by
// src/auth.js per request, so setting it here (before tests run) is enough.
process.env.JWT_SECRET = "test-only-fake-secret";
process.env.JWT_EXPIRES_IN = "1h";

vi.mock("../prisma.js", () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../prisma.js";

const TEST_SECRET = "test-only-fake-secret";

const lawyerAToken = jwt.sign({ sub: "lawyer-a", role: "LAWYER" }, TEST_SECRET);
const lawyerBToken = jwt.sign({ sub: "lawyer-b", role: "LAWYER" }, TEST_SECRET);
const clientRoleToken = jwt.sign({ sub: "user-9", role: "CLIENT" }, TEST_SECRET);

const CLIENT_KEYS = ["createdAt", "email", "id", "name", "phone", "updatedAt"];

const baseClient = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ava Client",
  email: "ava@example.com",
  phone: "+1-555-0100",
  createdAt: new Date("2026-10-13T00:00:00.000Z"),
  updatedAt: new Date("2026-10-13T00:00:00.000Z"),
};

function expectErrorShape(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(typeof res.body.error.message).toBe("string");
  expect(Array.isArray(res.body.error.details)).toBe(true);
}

function knownError(code) {
  return new Prisma.PrismaClientKnownRequestError("mocked prisma error", {
    code,
    clientVersion: "6.19.0",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/clients", () => {
  it("returns 201 with the safe client fields only", async () => {
    prisma.client.create.mockResolvedValue(baseClient);

    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ name: "Ava Client", email: "ava@example.com", phone: "+1-555-0100" });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.client).sort()).toEqual(CLIENT_KEYS);
  });

  it("stores the token lawyerId even when the body sends another lawyerId and a userId", async () => {
    prisma.client.create.mockResolvedValue(baseClient);

    await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({
        name: "Ava Client",
        email: "ava@example.com",
        lawyerId: "lawyer-evil",
        userId: "user-evil",
      });

    const data = prisma.client.create.mock.calls[0][0].data;
    expect(data.lawyerId).toBe("lawyer-a");
    expect(data).not.toHaveProperty("userId");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ email: "ava@example.com" });

    expectErrorShape(res, 400, "VALIDATION_ERROR");
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad email", async () => {
    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ name: "Ava", email: "not-an-email" });

    expectErrorShape(res, 400, "VALIDATION_ERROR");
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("stores email trimmed and lowercase", async () => {
    prisma.client.create.mockResolvedValue(baseClient);

    await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ name: "Ava", email: "  AVA@Example.COM " });

    expect(prisma.client.create.mock.calls[0][0].data.email).toBe(
      "ava@example.com"
    );
  });

  it("stores an empty phone as null", async () => {
    prisma.client.create.mockResolvedValue(baseClient);

    await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ name: "Ava", phone: "" });

    const data = prisma.client.create.mock.calls[0][0].data;
    expect(data.phone).toBeNull();
    expect(data.email).toBeNull();
  });

  it("returns 403 for a non-LAWYER role and 401 with no token", async () => {
    const forbidden = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${clientRoleToken}`)
      .send({ name: "Ava" });
    expectErrorShape(forbidden, 403, "FORBIDDEN");

    const unauthenticated = await request(app)
      .post("/api/clients")
      .send({ name: "Ava" });
    expectErrorShape(unauthenticated, 401, "UNAUTHENTICATED");
    expect(prisma.client.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/clients", () => {
  it("uses page 1 and size 20 by default with lawyerId at the top level", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.count.mockResolvedValue(0);

    const res = await request(app)
      .get("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    const findManyArg = prisma.client.findMany.mock.calls[0][0];
    expect(findManyArg.where).toEqual({ lawyerId: "lawyer-a" });
    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(20);
    expect(findManyArg.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "asc" },
    ]);
    expect(prisma.client.count.mock.calls[0][0]).toEqual({
      where: { lawyerId: "lawyer-a" },
    });
  });

  it("puts search in a separate OR array and keeps lawyerId at the top level", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.count.mockResolvedValue(0);

    await request(app)
      .get("/api/clients?q=ava")
      .set("Authorization", `Bearer ${lawyerAToken}`);

    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.lawyerId).toBe("lawyer-a");
    expect(where.OR).toEqual([
      { name: { contains: "ava", mode: "insensitive" } },
      { email: { contains: "ava", mode: "insensitive" } },
      { phone: { contains: "ava", mode: "insensitive" } },
    ]);
    expect(where.OR).not.toContainEqual(
      expect.objectContaining({ lawyerId: expect.anything() })
    );
  });

  it.each([["pageSize=101"], ["pageSize=0"], ["pageSize=abc"], ["page=0"]])(
    "returns 400 for out-of-range query %s",
    async (query) => {
      const res = await request(app)
        .get(`/api/clients?${query}`)
        .set("Authorization", `Bearer ${lawyerAToken}`);

      expectErrorShape(res, 400, "VALIDATION_ERROR");
      expect(prisma.client.findMany).not.toHaveBeenCalled();
    }
  );

  it("returns 400 for a disallowed sortBy and the right orderBy for a valid sort", async () => {
    const bad = await request(app)
      .get("/api/clients?sortBy=email")
      .set("Authorization", `Bearer ${lawyerAToken}`);
    expectErrorShape(bad, 400, "VALIDATION_ERROR");

    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.count.mockResolvedValue(0);
    await request(app)
      .get("/api/clients?sortBy=name&order=asc")
      .set("Authorization", `Bearer ${lawyerAToken}`);
    expect(prisma.client.findMany.mock.calls[0][0].orderBy).toEqual([
      { name: "asc" },
      { id: "asc" },
    ]);
  });

  it("computes totalPages from the shared count", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.count.mockResolvedValue(45);

    const res = await request(app)
      .get("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expect(res.body.total).toBe(45);
    expect(res.body.totalPages).toBe(3);
  });

  it("never returns lawyerId in list rows", async () => {
    prisma.client.findMany.mockResolvedValue([baseClient]);
    prisma.client.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/api/clients")
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expect(Object.keys(res.body.data[0]).sort()).toEqual(CLIENT_KEYS);
    expect(prisma.client.findMany.mock.calls[0][0].select).not.toHaveProperty(
      "lawyerId"
    );
  });

  it("filters by hasCases without widening the lawyer scope", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    prisma.client.count.mockResolvedValue(0);

    await request(app)
      .get("/api/clients?hasCases=true")
      .set("Authorization", `Bearer ${lawyerAToken}`);
    let where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      lawyerId: "lawyer-a",
      cases: { some: {} },
    });

    await request(app)
      .get("/api/clients?hasCases=false")
      .set("Authorization", `Bearer ${lawyerAToken}`);
    where = prisma.client.findMany.mock.calls[1][0].where;
    expect(where).toEqual({
      lawyerId: "lawyer-a",
      cases: { none: {} },
    });
  });
});

describe("GET /api/clients/:id", () => {
  it("reads with id and lawyerId and returns the case history", async () => {
    const profile = {
      ...baseClient,
      cases: [
        {
          id: "case-1",
          title: "Demo Case",
          caseNumber: "DEMO-001",
          status: "OPEN",
          court: "Demo County Court",
          type: "Civil",
          createdAt: new Date("2026-10-13T00:00:00.000Z"),
        },
      ],
    };
    prisma.client.findFirst.mockResolvedValue(profile);

    const res = await request(app)
      .get(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.client.cases).toHaveLength(1);
    expect(res.body.client.cases[0].caseNumber).toBe("DEMO-001");
    const arg = prisma.client.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ id: baseClient.id, lawyerId: "lawyer-a" });
    expect(arg.select.cases.where).toEqual({ lawyerId: "lawyer-a" });
  });

  it("returns 404 for a missing record and for another lawyer's record", async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    const missing = await request(app)
      .get(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`);
    expectErrorShape(missing, 404, "NOT_FOUND");

    const other = await request(app)
      .get(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerBToken}`);
    expectErrorShape(other, 404, "NOT_FOUND");
    expect(prisma.client.findFirst.mock.calls[1][0].where).toEqual({
      id: baseClient.id,
      lawyerId: "lawyer-b",
    });
  });

  it("returns 400 for a malformed id without touching Prisma", async () => {
    const res = await request(app)
      .get("/api/clients/not-a-uuid")
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expectErrorShape(res, 400, "VALIDATION_ERROR");
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/clients/:id", () => {
  it("updates with id and lawyerId and ignores a body lawyerId", async () => {
    prisma.client.update.mockResolvedValue({ ...baseClient, name: "New Name" });

    const res = await request(app)
      .patch(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ name: "New Name", lawyerId: "lawyer-evil" });

    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe("New Name");
    const arg = prisma.client.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: baseClient.id, lawyerId: "lawyer-a" });
    expect(arg.data).toEqual({ name: "New Name" });
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app)
      .patch(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({});

    expectErrorShape(res, 400, "VALIDATION_ERROR");
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("clears email when null is sent", async () => {
    prisma.client.update.mockResolvedValue({ ...baseClient, email: null });

    const res = await request(app)
      .patch(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`)
      .send({ email: null });

    expect(res.status).toBe(200);
    expect(prisma.client.update.mock.calls[0][0].data).toEqual({
      email: null,
    });
  });

  it("returns 404 for another lawyer's record", async () => {
    prisma.client.update.mockRejectedValue(knownError("P2025"));

    const res = await request(app)
      .patch(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerBToken}`)
      .send({ name: "Takeover" });

    expectErrorShape(res, 404, "NOT_FOUND");
    expect(prisma.client.update.mock.calls[0][0].where).toEqual({
      id: baseClient.id,
      lawyerId: "lawyer-b",
    });
  });
});

describe("DELETE /api/clients/:id", () => {
  it("deletes with id and lawyerId and returns an empty 204", async () => {
    prisma.client.delete.mockResolvedValue({ id: baseClient.id });

    const res = await request(app)
      .delete(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(prisma.client.delete.mock.calls[0][0].where).toEqual({
      id: baseClient.id,
      lawyerId: "lawyer-a",
    });
  });

  it("returns 404 for another lawyer's record", async () => {
    prisma.client.delete.mockRejectedValue(knownError("P2025"));

    const res = await request(app)
      .delete(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerBToken}`);

    expectErrorShape(res, 404, "NOT_FOUND");
    expect(prisma.client.delete.mock.calls[0][0].where).toEqual({
      id: baseClient.id,
      lawyerId: "lawyer-b",
    });
  });

  it("returns 409 CLIENT_HAS_CASES when the database refuses the delete", async () => {
    prisma.client.delete.mockRejectedValue(knownError("P2003"));

    const res = await request(app)
      .delete(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expectErrorShape(res, 409, "CLIENT_HAS_CASES");
  });
});

describe("client error handling", () => {
  it("returns 500 INTERNAL_ERROR without leaking DB text on unexpected failure", async () => {
    prisma.client.findFirst.mockRejectedValue(
      new Error("boom-client-db-text")
    );

    const res = await request(app)
      .get(`/api/clients/${baseClient.id}`)
      .set("Authorization", `Bearer ${lawyerAToken}`);

    expectErrorShape(res, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("boom-client-db-text");
  });
});
