import { describe, expect, it, vi } from "vitest";
import { requireRole } from "./auth.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireRole", () => {
  it("returns 401 UNAUTHENTICATED when no user is attached", () => {
    const res = mockRes();
    const next = vi.fn();

    requireRole("LAWYER")({}, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        details: [],
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 FORBIDDEN for a disallowed role", () => {
    const res = mockRes();
    const next = vi.fn();

    requireRole("LAWYER")({ userId: "user-9", userRole: "CLIENT" }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "FORBIDDEN", message: "Access denied.", details: [] },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for an allowed role", () => {
    const res = mockRes();
    const next = vi.fn();

    requireRole("LAWYER")({ userId: "user-1", userRole: "LAWYER" }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("accepts any of several allowed roles", () => {
    const res = mockRes();
    const next = vi.fn();

    requireRole("LAWYER", "ADMIN")(
      { userId: "user-2", userRole: "ADMIN" },
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
