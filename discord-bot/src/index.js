import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

const token = process.env.DISCORD_BOT_TOKEN;
const apiSecret = process.env.FORM_API_SECRET;
const port = Number(process.env.PORT || 8787);
const dataFile = path.resolve(process.env.DATA_FILE || './data/channel-codes.json');
if (!token || !apiSecret) throw new Error('DISCORD_BOT_TOKEN and FORM_API_SECRET are required');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { const origin = String(req.headers.origin || ''); const allowed = process.env.PUBLIC_FORM_ORIGIN; if (origin && allowed && origin !== allowed) return res.status(403).json({ error: 'origin_not_allowed' }); if (origin) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{3,32}$/);
const notificationSchema = z.object({ code: codeSchema, formTitle: z.string().min(1).max(200), answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}), submittedAt: z.string().max(80).optional() });
let channelCodes = {};
const audit = [];

async function loadData() { try { channelCodes = JSON.parse(await readFile(dataFile, 'utf8')); } catch { await mkdir(path.dirname(dataFile), { recursive: true }); await saveData(); } }
async function saveData() { await mkdir(path.dirname(dataFile), { recursive: true }); await writeFile(dataFile, JSON.stringify(channelCodes, null, 2), 'utf8'); }
function safeEqual(a, b) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function authorized(req) { const value = String(req.headers.authorization || ''); return value.startsWith('Bearer ') && safeEqual(value.slice(7), apiSecret); }
function formatAnswer(value) { return Array.isArray(value) ? value.join(', ') : value || '未回答'; }
function chunks(text, size = 1800) { const result = []; for (let i = 0; i < text.length; i += size) result.push(text.slice(i, i + size)); return result; }

app.get('/health', (_req, res) => res.json({ ok: true, botReady: client.isReady(), registeredCodes: Object.keys(channelCodes).length }));
app.post(['/notify', '/public-notify'], async (req, res) => {
  if (req.path === '/notify' && !authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
  const { code, formTitle, answers, submittedAt } = parsed.data;
  const channelId = channelCodes[code];
  if (!channelId) return res.status(404).json({ error: 'unknown_code' });
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error('target_channel_not_text');
    const lines = Object.entries(answers).map(([question, value]) => `**${question}**\n${formatAnswer(value)}`);
    const body = [`## 新しい応募`, `**フォーム:** ${formTitle}`, `**受付日時:** ${submittedAt || new Date().toISOString()}`, '', ...lines].join('\n');
    for (const piece of chunks(body)) await channel.send(piece);
    audit.unshift({ at: new Date().toISOString(), code, channelId, result: 'sent' });
    audit.splice(100);
    return res.json({ ok: true });
  } catch (error) {
    audit.unshift({ at: new Date().toISOString(), code, channelId, result: 'failed', error: String(error?.message || error) });
    audit.splice(100);
    return res.status(502).json({ error: 'discord_delivery_failed' });
  }
});
app.get('/audit', (req, res) => authorized(req) ? res.json(audit) : res.status(401).json({ error: 'unauthorized' }));

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const match = message.content.trim().match(/^!set-([A-Za-z0-9_-]{3,32})$/);
  const unset = message.content.trim().match(/^!unset-([A-Za-z0-9_-]{3,32})$/);
  if (!match && !unset) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('この操作にはチャンネル管理権限が必要です。');
  const code = (match || unset)[1];
  if (match) { channelCodes[code] = message.channel.id; await saveData(); return message.reply(`識別コード「${code}」をこのチャンネルに設定しました。`); }
  delete channelCodes[code]; await saveData(); return message.reply(`識別コード「${code}」を解除しました。`);
});

await loadData();
await client.login(token);
app.listen(port, '0.0.0.0', () => console.log(`Entry Atelier bot API listening on ${port}`));
