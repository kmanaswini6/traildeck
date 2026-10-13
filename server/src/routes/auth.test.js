import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake secret for tests only. Never the real .env value. Read lazily by
// src/auth.js per request, so setting it here (before tests run) is enough.
process.env.JWT_SECRET = "test-only-fake-secret";
process.env.JWT_EXPIRES_IN = "1h";

vi.mock("../prisma.js", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

import request from "supertest";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../prisma.js";

const TEST_SECRET = "test-only-fake-secret";
const KNOWN_PASSWORD = "correct-password-1";
const KNOWN_HASH = bcryptjs.hashSync(KNOWN_PASSWORD, 10);

const baseUser = {
  id: "user-1",
  name: "Ava Client",
  email: "ava@example.com",
  passwordHash: KNOWN_HASH,
  role: "CLIENT",
  createdAt: new Date("2026-10-13T00:00:00.000Z"),
};

const SAFE_KEYS = ["createdAt", "email", "id", "name", "role"];

function expectErrorShape(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(typeof res.body.error.message).toBe("string");
  expect(Array.isArray(res.body.error.details)).toBe(true);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with { user, token }", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { passwordHash, ...safe } = baseUser;
    prisma.user.create.mockResolvedValue(safe);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava Client", email: "ava@example.com", password: "new-password-1" });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual(SAFE_KEYS);
    expect(res.body.user.email).toBe("ava@example.com");
    expect(typeof res.body.token).toBe("string");
    const payload = jwt.verify(res.body.token, TEST_SECRET);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("CLIENT");
  });

  it("stores a bcrypt hash that verifies the password and differs from it", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { passwordHash, ...safe } = baseUser;
    prisma.user.create.mockResolvedValue(safe);
    const password = "new-password-1";

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava Client", email: "ava@example.com", password });

    const stored = prisma.user.create.mock.calls[0][0].data.passwordHash;
    expect(stored).not.toBe(password);
    expect(await bcryptjs.compare(password, stored)).toBe(true);
  });

  it("never exposes the hash or raw password in the response", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { passwordHash, ...safe } = baseUser;
    prisma.user.create.mockResolvedValue(safe);
    const password = "new-password-1";

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava Client", email: "ava@example.com", password });

    const stored = prisma.user.create.mock.calls[0][0].data.passwordHash;
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain(stored);
    expect(text).not.toContain(password);
  });

  it("stores the email trimmed and lowercase", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { passwordHash, ...safe } = baseUser;
    prisma.user.create.mockResolvedValue(safe);

    await request(app)
      .post("/api/auth/register")
      .send({ name: "  Ava Client  ", email: "  AVA@Example.COM ", password: "new-password-1" });

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe("ava@example.com");
    expect(data.name).toBe("Ava Client");
  });

  it("returns 409 EMAIL_IN_USE for a duplicate email", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava Client", email: "ava@example.com", password: "new-password-1" });

    expectErrorShape(res, 409, "EMAIL_IN_USE");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 on a Prisma unique-violation race at create", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        { code: "P2002", clientVersion: "6.19.0" }
      )
    );

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava Client", email: "ava@example.com", password: "new-password-1" });

    expectErrorShape(res, 409, "EMAIL_IN_USE");
  });

  it.each([
    ["missing name", { email: "ava@example.com", password: "new-password-1" }],
    ["bad email", { name: "Ava", email: "not-an-email", password: "new-password-1" }],
    ["7-character password", { name: "Ava", email: "ava@example.com", password: "a".repeat(7) }],
    ["73-character password", { name: "Ava", email: "ava@example.com", password: "a".repeat(73) }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const res = await request(app).post("/api/auth/register").send(body);

    expectErrorShape(res, 400, "VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
    if (body.password) {
      expect(JSON.stringify(res.body)).not.toContain(body.password);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it.each([["CLIENT"], ["LAWYER"]])(
    "ignores a client-supplied role %s and creates CLIENT",
    async (role) => {
      prisma.user.findUnique.mockResolvedValue(null);
      const { passwordHash, ...safe } = baseUser;
      prisma.user.create.mockResolvedValue(safe);

      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Ava", email: "ava@example.com", password: "new-password-1", role });

      expect(res.status).toBe(201);
      expect(prisma.user.create.mock.calls[0][0].data.role).toBe("CLIENT");
      expect(res.body.user.role).toBe("CLIENT");
    }
  );
});

describe("POST /api/auth/login", () => {
  it("returns 200 with the safe user and a verifiable token", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ava@example.com", password: KNOWN_PASSWORD });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.user).sort()).toEqual(SAFE_KEYS);
    const payload = jwt.verify(res.body.token, TEST_SECRET);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("CLIENT");
    expect(payload.email).toBeUndefined();
  });

  it("returns identical responses for wrong password and unknown email", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(baseUser)
      .mockResolvedValueOnce(null);

    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "ava@example.com", password: "wrong-password-1" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password-1" });

    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expectErrorShape(wrong, 401, "INVALID_CREDENTIALS");
  });

  it.each([
    ["missing email", { password: KNOWN_PASSWORD }],
    ["missing password", { email: "ava@example.com" }],
    ["non-string password", { email: "ava@example.com", password: 12345678 }],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await request(app).post("/api/auth/login").send(body);
    expectErrorShape(res, 400, "VALIDATION_ERROR");
  });

  it("never exposes the hash or raw password", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ava@example.com", password: KNOWN_PASSWORD });

    const text = JSON.stringify(res.body);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain(KNOWN_HASH);
    expect(text).not.toContain(KNOWN_PASSWORD);
  });
});

describe("GET /api/auth/me", () => {
  const signed = (payload, secret = TEST_SECRET, opts = {}) =>
    jwt.sign(payload, secret, opts);
  const { passwordHash, ...safe } = baseUser;

  it("returns the matching user for a valid token", async () => {
    prisma.user.findUnique.mockResolvedValue(safe);
    const token = signed({ sub: "user-1", role: "CLIENT" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.user).sort()).toEqual(SAFE_KEYS);
    expect(res.body.user.id).toBe("user-1");
    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: "user-1" });
  });

  it("returns 401 UNAUTHENTICATED with no header", async () => {
    const res = await request(app).get("/api/auth/me");
    expectErrorShape(res, 401, "UNAUTHENTICATED");
  });

  it("returns 401 UNAUTHENTICATED for a non-Bearer scheme", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Basic abc123");
    expectErrorShape(res, 401, "UNAUTHENTICATED");
  });

  it("returns 401 UNAUTHENTICATED for Bearer with no token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer");
    expectErrorShape(res, 401, "UNAUTHENTICATED");
  });

  it("returns 401 INVALID_TOKEN for a garbage token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.token");
    expectErrorShape(res, 401, "INVALID_TOKEN");
  });

  it("returns 401 INVALID_TOKEN for a token signed with another secret", async () => {
    const token = signed({ sub: "user-1", role: "CLIENT" }, "different-secret");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expectErrorShape(res, 401, "INVALID_TOKEN");
  });

  it("returns 401 TOKEN_EXPIRED for an expired token", async () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        role: "CLIENT",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      TEST_SECRET
    );
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expectErrorShape(res, 401, "TOKEN_EXPIRED");
  });

  it("returns 401 for a token whose user no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const token = signed({ sub: "deleted-user", role: "CLIENT" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(typeof res.body.error.message).toBe("string");
  });

  it("excludes passwordHash from the response", async () => {
    prisma.user.findUnique.mockResolvedValue(safe);
    const token = signed({ sub: "user-1", role: "CLIENT" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("error handling", () => {
  it("returns 500 INTERNAL_ERROR without leaking DB text on unexpected failure", async () => {
    prisma.user.findUnique.mockRejectedValue(new Error("boom-simulated-db-text"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ava", email: "ava@example.com", password: "new-password-1" });

    expectErrorShape(res, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("boom-simulated-db-text");
  });
});
