import { describe, expect, it } from "vitest";

describe("Discord OAuth server credentials", () => {
  it("recognizes the configured client without exposing its secret", async () => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    expect(clientId, "DISCORD_CLIENT_ID is required").toBeTruthy();
    expect(clientSecret, "DISCORD_CLIENT_SECRET is required").toBeTruthy();

    const body = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: "authorization_code",
      code: "validation-only-invalid-code",
      redirect_uri: "https://entryform-4xosiknu.manus.space/api/discord/callback",
    });
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    expect(response.status).not.toBe(401);
    expect(text).not.toContain("invalid_client");
  }, 15000);
});
