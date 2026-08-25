import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseCtx = (role: "user" | "admin"): TrpcContext => ({
  user: { id: 1, openId: "test", name: "Test", email: "test@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("admin access control", () => {
  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(baseCtx("user"));
    await expect(caller.admin.forms()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated users", async () => {
    const ctx = { ...baseCtx("user"), user: undefined } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.forms()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
