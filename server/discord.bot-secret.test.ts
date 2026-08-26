import { describe, expect, it } from "vitest";

describe("VPS Bot server-side secret", () => {
  it("accepts the configured server-only bearer secret", async () => {
    const endpoint = process.env.VPS_BOT_API_URL;
    const secret = process.env.VPS_BOT_API_SECRET;
    expect(endpoint, "VPS_BOT_API_URL is required").toBeTruthy();
    expect(secret, "VPS_BOT_API_SECRET is required").toBeTruthy();
    const response = await fetch(new URL("/guilds", endpoint).toString(), {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10000),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { guilds?: unknown };
    expect(Array.isArray(body.guilds)).toBe(true);
  }, 15000);
});
