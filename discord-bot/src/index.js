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
const dataDir = path.resolve(process.env.DATA_DIR || './data');
const codesFile = path.join(dataDir, 'channel-codes.json');
const submissionsFile = path.join(dataDir, 'submissions.json');
if (!token || !apiSecret) throw new Error('DISCORD_BOT_TOKEN and FORM_API_SECRET are required');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  const allowed = process.env.PUBLIC_FORM_ORIGIN;
  if (origin && allowed && origin !== allowed) return res.status(403).json({ error: 'origin_not_allowed' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{3,32}$/);
const answerValueSchema = z.union([z.string().max(2000), z.array(z.string().max(500)).max(20)]);
const notificationSchema = z.object({ code: codeSchema, formTitle: z.string().min(1).max(200), answers: z.record(z.string().min(1).max(300), answerValueSchema).refine(value => Object.keys(value).length <= 50, 'too_many_answers').default({}), submittedAt: z.string().max(80).optional() }).strict();
let channelCodes = {};
let submissions = [];

async function readJson(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } }
async function saveJson(file, value) { await mkdir(dataDir, { recursive: true }); await writeFile(file, JSON.stringify(value, null, 2), 'utf8'); }
async function loadData() { channelCodes = await readJson(codesFile, {}); submissions = await readJson(submissionsFile, []); }
async function saveCodes() { await saveJson(codesFile, channelCodes); }
async function saveSubmissions() { await saveJson(submissionsFile, submissions.slice(0, 500)); }
function safeEqual(a, b) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function authorized(req) { const value = String(req.headers.authorization || ''); return value.startsWith('Bearer ') && safeEqual(value.slice(7), apiSecret); }
function normalizeCode(value) { return String(value || '').trim().toUpperCase(); }
function formatAnswer(value) { return Array.isArray(value) ? value.join(', ') : value || '未回答'; }
function embedFields(submission) { return Object.entries(submission.answers).map(([question, value]) => ({ name: question.slice(0, 256), value: formatAnswer(value).slice(0, 1024) || '未回答', inline: false })); }
async function deliver(submission) {
  const channelId = channelCodes[normalizeCode(submission.code)];
  if (!channelId) throw new Error('unknown_code');
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error('target_channel_not_text');
  const fields = embedFields(submission);
  for (let i = 0; i < Math.max(1, fields.length); i += 25) {
    const page = fields.slice(i, i + 25);
    await channel.send({ embeds: [{ title: i ? `新しい応募（続き ${Math.floor(i / 25) + 1}）` : '新しい応募', color: 0xA57B36, description: i === 0 ? `フォーム: ${submission.formTitle}` : undefined, fields: page, footer: i === 0 ? { text: `受付ID: ${submission.id}` } : undefined, timestamp: submission.submittedAt || new Date().toISOString() }] });
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, botReady: client.isReady(), registeredCodes: Object.keys(channelCodes).length, pending: submissions.filter(item => item.status === 'failed').length }));
app.get('/guilds', (req, res) => { if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' }); return res.json({ guilds: [...client.guilds.cache.values()].map(guild => ({ id: guild.id, name: guild.name })).sort((a, b) => a.name.localeCompare(b.name, 'ja')) }); });
app.get('/guilds/:guildId/channels', (req, res) => { if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' }); const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.status(404).json({ error: 'guild_not_found' }); const me = guild.members.me; const channels = [...guild.channels.cache.values()].filter(channel => channel.isTextBased() && !channel.isThread() && me?.permissionsIn(channel).has(PermissionFlagsBits.ViewChannel) && me.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)).map(channel => ({ id: channel.id, name: channel.name, type: channel.type })).sort((a, b) => a.name.localeCompare(b.name, 'ja')); return res.json({ guildId: guild.id, channels }); });
app.post('/register', async (req, res) => { if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' }); const parsed = z.object({ guildId: z.string().regex(/^\d{15,25}$/), channelId: z.string().regex(/^\d{15,25}$/), code: codeSchema }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' }); const guild = client.guilds.cache.get(parsed.data.guildId); const channel = guild?.channels.cache.get(parsed.data.channelId); const me = guild?.members.me; if (!guild || !channel) return res.status(404).json({ error: 'channel_not_found' }); if (!channel.isTextBased() || channel.isThread() || !me?.permissionsIn(channel).has(PermissionFlagsBits.ViewChannel) || !me.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) return res.status(403).json({ error: 'channel_not_writable' }); channelCodes[normalizeCode(parsed.data.code)] = channel.id; await saveCodes(); return res.json({ ok: true, code: normalizeCode(parsed.data.code), guildId: guild.id, channelId: channel.id, channelName: channel.name }); });
app.post('/notify', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
  const submission = { id: crypto.randomUUID(), ...parsed.data, submittedAt: parsed.data.submittedAt || new Date().toISOString(), status: 'pending', attempts: 0, createdAt: new Date().toISOString() };
  submissions.unshift(submission);
  await saveSubmissions();
  try {
    submission.attempts += 1;
    await deliver(submission);
    submission.status = 'sent';
    submission.sentAt = new Date().toISOString();
    await saveSubmissions();
    return res.json({ ok: true, id: submission.id });
  } catch (error) {
    submission.status = 'failed';
    submission.error = String(error?.message || error);
    await saveSubmissions();
    return res.status(502).json({ error: 'discord_delivery_failed', id: submission.id });
  }
});
app.post('/retry/:id', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const submission = submissions.find(item => item.id === req.params.id);
  if (!submission) return res.status(404).json({ error: 'not_found' });
  try {
    submission.attempts += 1;
    await deliver(submission);
    submission.status = 'sent';
    submission.sentAt = new Date().toISOString();
    delete submission.error;
    await saveSubmissions();
    return res.json({ ok: true, id: submission.id });
  } catch (error) {
    submission.status = 'failed';
    submission.error = String(error?.message || error);
    await saveSubmissions();
    return res.status(502).json({ error: 'discord_delivery_failed', id: submission.id });
  }
});
app.get('/audit', (req, res) => authorized(req) ? res.json(submissions.slice(0, 100)) : res.status(401).json({ error: 'unauthorized' }));

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const match = message.content.trim().match(/^!set-([A-Za-z0-9_-]{3,32})$/);
  const unset = message.content.trim().match(/^!unset-([A-Za-z0-9_-]{3,32})$/);
  if (!match && !unset) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('この操作にはチャンネル管理権限が必要です。');
  const code = normalizeCode((match || unset)[1]);
  if (match) { channelCodes[code] = message.channel.id; await saveCodes(); return message.reply(`識別コード「${code}」をこのチャンネルに設定しました。ここへ応募通知を送信します。`); }
  delete channelCodes[code]; await saveCodes(); return message.reply(`識別コード「${code}」を解除しました。`);
});

await loadData();
await client.login(token);
app.listen(port, '0.0.0.0', () => console.log(`Entry Atelier bot API listening on ${port}`));
