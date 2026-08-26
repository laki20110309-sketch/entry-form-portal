import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { EncryptJWT, jwtDecrypt } from "jose";
import { ENV } from "./_core/env";

const STATE_COOKIE = "discord_oauth_state";
const SESSION_COOKIE = "discord_oauth_session";
const REDIRECT_URI = "https://entryform-4xosiknu.manus.space/api/discord/callback";
const SESSION_MAX_AGE = 60 * 60;
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

type DiscordSession = { accessToken: string; discordUserId: string; username: string };
type DiscordGuild = { id: string; name: string; owner?: boolean; permissions?: string };

function key() {
  return crypto.createHash("sha256").update(ENV.cookieSecret || "discord-session-fallback").digest();
}
function secure(req: Request) { return req.protocol === "https" || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"; }
function randomState() { return crypto.randomBytes(32).toString("hex"); }
function hasGuildAdminPermission(guild: DiscordGuild) { try { const permissions = BigInt(guild.permissions || "0"); return guild.owner === true || (permissions & ADMINISTRATOR) !== BigInt(0) || (permissions & MANAGE_GUILD) !== BigInt(0); } catch { return false; } }
function getCookie(req: Request, name: string) { const raw = String(req.headers.cookie || ""); return raw.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1); }
function safeEqual(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && crypto.timingSafeEqual(left, right); }

export async function createDiscordSession(session: DiscordSession) { return new EncryptJWT(session).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).encrypt(key()); }
export async function getDiscordSession(req: Request): Promise<DiscordSession | null> { const token = getCookie(req, SESSION_COOKIE); if (!token) return null; try { const result = await jwtDecrypt<DiscordSession>(token, key()); return result.payload.accessToken && result.payload.discordUserId ? { accessToken: result.payload.accessToken, discordUserId: result.payload.discordUserId, username: String(result.payload.username || "Discord user") } : null; } catch { return null; } }

async function discordApi<T>(path: string, accessToken: string): Promise<T> { const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`Discord API returned ${response.status}`); return response.json() as Promise<T>; }
export async function getDiscordGuilds(accessToken: string) { return discordApi<DiscordGuild[]>("/users/@me/guilds", accessToken); }
export async function getDiscordUser(accessToken: string) { return discordApi<{ id: string; username: string; global_name?: string | null }>("/users/@me", accessToken); }
export function filterAdminGuilds(guilds: DiscordGuild[]) { return guilds.filter(hasGuildAdminPermission).map(guild => ({ id: guild.id, name: guild.name })); }

export function registerDiscordOAuthRoutes(app: Express) {
  app.get("/api/discord/login", (_req: Request, res: Response) => {
    if (!ENV.discordClientId) { res.status(503).json({ error: "Discord OAuth is not configured" }); return; }
    const state = randomState();
    res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: secure(_req), sameSite: "lax", path: "/", maxAge: 600000 });
    const params = new URLSearchParams({ client_id: ENV.discordClientId, redirect_uri: ENV.discordRedirectUri || REDIRECT_URI, response_type: "code", scope: "identify guilds", state, prompt: "consent" });
    res.redirect(302, `https://discord.com/oauth2/authorize?${params}`);
  });
  app.get("/api/discord/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expected = getCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: secure(req), sameSite: "lax", path: "/" });
    if (!code || !state || !expected || !safeEqual(state, expected)) { res.status(403).json({ error: "invalid Discord OAuth state" }); return; }
    try {
      const body = new URLSearchParams({ client_id: ENV.discordClientId, client_secret: ENV.discordClientSecret, grant_type: "authorization_code", code, redirect_uri: ENV.discordRedirectUri || REDIRECT_URI });
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(8000) });
      if (!tokenResponse.ok) throw new Error(`Discord token exchange returned ${tokenResponse.status}`);
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) throw new Error("Discord access token missing");
      const user = await getDiscordUser(token.access_token);
      const session = await createDiscordSession({ accessToken: token.access_token, discordUserId: user.id, username: user.global_name || user.username });
      res.cookie(SESSION_COOKIE, session, { httpOnly: true, secure: secure(req), sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE * 1000 });
      res.redirect(302, "/manage");
    } catch (error) { console.error("[Discord OAuth] Callback failed", error); res.status(502).json({ error: "Discord OAuth callback failed" }); }
  });
  app.get("/api/discord/logout", (req: Request, res: Response) => { res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: secure(req), sameSite: "lax", path: "/" }); res.redirect(302, "/manage"); });
}
