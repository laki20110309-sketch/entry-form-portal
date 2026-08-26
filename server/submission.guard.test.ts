import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { enforceSubmissionGuard } from "./routers";

describe("enforceSubmissionGuard", () => {
  it("accepts the production GitHub Pages origin", () => {
    expect(() =>
      enforceSubmissionGuard({
        headers: {
          origin: "https://laki20110309-sketch.github.io",
          "x-forwarded-for": `github-pages-${Date.now()}`,
        },
      }),
    ).not.toThrow();
  });

  it("rejects an unrelated origin", () => {
    expect(() =>
      enforceSubmissionGuard({
        headers: {
          origin: "https://example.com",
          "x-forwarded-for": `untrusted-${Date.now()}`,
        },
      }),
    ).toThrowError(expect.objectContaining<TRPCError>({ code: "FORBIDDEN", message: "安全確認に失敗しました。" }));
  });
});
