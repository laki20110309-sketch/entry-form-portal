import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, answers, forms, integrations, questions, submissions, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = values[field]; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  values.lastSignedIn ??= new Date(); updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function listForms() { const db = await getDb(); if (!db) return []; return db.select().from(forms).orderBy(desc(forms.updatedAt)); }
export async function getFormBySlug(slug: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(forms).where(eq(forms.slug, slug)).limit(1); return result[0]; }
export async function getFormById(id: number) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(forms).where(eq(forms.id, id)).limit(1); return result[0]; }
export async function getQuestions(formId: number) { const db = await getDb(); if (!db) return []; return db.select().from(questions).where(eq(questions.formId, formId)).orderBy(asc(questions.position), asc(questions.id)); }
export async function listSubmissions(formId?: number) { const db = await getDb(); if (!db) return []; return db.select().from(submissions).where(formId ? eq(submissions.formId, formId) : undefined).orderBy(desc(submissions.submittedAt)); }
export async function getSubmission(id: number) { const db = await getDb(); if (!db) return undefined; const submission = (await db.select().from(submissions).where(eq(submissions.id, id)).limit(1))[0]; if (!submission) return undefined; const items = await db.select().from(answers).where(eq(answers.submissionId, id)); return { submission, answers: items }; }
export async function getIntegration(formId: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(integrations).where(eq(integrations.formId, formId)).limit(1))[0]; }
export async function insertSubmission(data: typeof submissions.$inferInsert, items: Array<typeof answers.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(submissions).values(data); const id = Number(result[0].insertId); if (items.length) await db.insert(answers).values(items.map(item => ({ ...item, submissionId: id }))); return id; }
export async function updateSubmissionStatus(id: number, status: "received" | "sent" | "failed", botError?: string) { const db = await getDb(); if (!db) return; await db.update(submissions).set({ status, botError: botError ?? null }).where(eq(submissions.id, id)); }
