import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { answers, forms, integrations, questions, submissions } from "../drizzle/schema";
import { getDb, getFormById, getFormBySlug, getIntegration, getQuestions, getSubmission, insertSubmission, listForms, listSubmissions, updateSubmissionStatus } from "./db";
import { and, eq } from "drizzle-orm";
import { ENV } from "./_core/env";

const questionType = z.enum(["short_text", "long_text", "email", "single_choice", "multiple_choice"]);
const questionInput = z.object({ id: z.number().optional(), label: z.string().min(1).max(300), description: z.string().max(2000).optional(), type: questionType, options: z.array(z.string().min(1).max(200)).max(30).default([]), required: z.boolean().default(false), position: z.number().int().min(0) });
const formInput = z.object({ title: z.string().min(1).max(200), slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(120), description: z.string().max(5000).optional(), status: z.enum(["draft", "open", "closed"]), successMessage: z.string().max(500).optional(), questions: z.array(questionInput) });
const recentSubmissions = new Map<string, number>();
function enforceSubmissionGuard(req: { headers: Record<string, unknown> }) {
  const origin = String(req.headers.origin ?? ""); const host = String(req.headers.host ?? "");
  if (origin && host) { try { if (new URL(origin).host !== host) throw new TRPCError({ code: "FORBIDDEN", message: "安全確認に失敗しました。" }); } catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: "安全確認に失敗しました。" }); } }
  const key = String(req.headers["x-forwarded-for"] ?? req.headers["user-agent"] ?? "anonymous"); const now = Date.now(); const previous = recentSubmissions.get(key) ?? 0;
  if (now - previous < 10000) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "短時間に送信が集中しています。少し待ってからお試しください。" });
  recentSubmissions.set(key, now); if (recentSubmissions.size > 5000) recentSubmissions.clear();
}

async function notifyBot(formId: number, payload: unknown) {
  const integration = await getIntegration(formId);
  if (!integration || !integration.enabled) return { sent: false };
  const endpoint = ENV.vpsBotApiUrl || integration.endpointUrl;
  if (!endpoint) throw new Error("Bot endpoint is not configured");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ENV.vpsBotApiSecret) headers.authorization = `Bearer ${ENV.vpsBotApiSecret}`;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ code: integration.notificationCode, formTitle: (payload as { formTitle?: string }).formTitle ?? "応募フォーム", answers: (payload as { answers?: unknown }).answers ?? {}, submittedAt: new Date().toISOString(), channel: integration.channelName, formId }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Bot endpoint returned ${response.status}`);
  return { sent: true };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  publicForms: router({
    get: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const form = await getFormBySlug(input.slug); if (!form || form.status !== "open") throw new TRPCError({ code: "NOT_FOUND", message: "このフォームは現在受付していません。" });
      return { form, questions: await getQuestions(form.id) };
    }),
    submit: publicProcedure.input(z.object({ slug: z.string(), values: z.record(z.string(), z.union([z.string(), z.array(z.string())])) })).mutation(async ({ input, ctx }) => {
      enforceSubmissionGuard(ctx.req);
      const form = await getFormBySlug(input.slug); if (!form || form.status !== "open") throw new TRPCError({ code: "NOT_FOUND", message: "このフォームは現在受付していません。" });
      const qs = await getQuestions(form.id); const valueMap = input.values;
      for (const q of qs) if (q.required && (!valueMap[String(q.id)] || (Array.isArray(valueMap[String(q.id)]) && valueMap[String(q.id)].length === 0))) throw new TRPCError({ code: "BAD_REQUEST", message: `「${q.label}」は必須項目です。` });
      const meta = { userAgent: ctx.req.headers["user-agent"] ?? "", submittedAt: new Date().toISOString() };
      const submissionId = await insertSubmission({ formId: form.id, status: "received", submitterMeta: JSON.stringify(meta) }, qs.map(q => ({ submissionId: 0, questionId: q.id, value: JSON.stringify(valueMap[String(q.id)] ?? "") })));
      const payload = { formTitle: form.title, submissionId, answers: qs.map(q => ({ question: q.label, answer: valueMap[String(q.id)] ?? "" })) };
      try { const result = await notifyBot(form.id, payload); await updateSubmissionStatus(submissionId, result.sent ? "sent" : "received"); } catch (error) { await updateSubmissionStatus(submissionId, "failed", error instanceof Error ? error.message : "Bot notification failed"); }
      return { success: true, message: form.successMessage ?? "回答を受け付けました。ありがとうございました。" };
    }),
  }),
  admin: router({
    forms: adminProcedure.query(() => listForms()),
    form: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => { const form = await getFormById(input.id); if (!form) throw new TRPCError({ code: "NOT_FOUND" }); return { form, questions: await getQuestions(input.id), integration: await getIntegration(input.id) }; }),
    saveForm: adminProcedure.input(formInput).mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await getFormBySlug(input.slug);
      const formValues = { title: input.title, slug: input.slug, description: input.description ?? null, status: input.status, successMessage: input.successMessage ?? null, createdBy: ctx.user.id };
      let formId: number;
      if (existing) { await db.update(forms).set(formValues).where(eq(forms.id, existing.id)); formId = existing.id; await db.delete(questions).where(eq(questions.formId, formId)); }
      else { const result = await db.insert(forms).values(formValues); formId = Number(result[0].insertId); }
      if (input.questions.length) await db.insert(questions).values(input.questions.map((q, index) => ({ formId, label: q.label, description: q.description ?? null, type: q.type, options: JSON.stringify(q.options), required: q.required ? 1 : 0, position: index })));
      return { id: formId };
    }),
    deleteForm: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await db.delete(questions).where(eq(questions.formId, input.id)); await db.delete(forms).where(eq(forms.id, input.id)); return { success: true }; }),
    cloneForm: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => { const db = await getDb(); const source = await getFormById(input.id); if (!db || !source) throw new TRPCError({ code: "NOT_FOUND" }); const slug = `${source.slug}-copy-${Date.now().toString().slice(-5)}`; const created = await db.insert(forms).values({ title: `${source.title}（複製）`, slug, description: source.description, status: "draft", successMessage: source.successMessage, createdBy: ctx.user.id }); const formId = Number(created[0].insertId); const qs = await getQuestions(input.id); if (qs.length) await db.insert(questions).values(qs.map(q => ({ formId, label: q.label, description: q.description, type: q.type, options: q.options, required: q.required, position: q.position }))); return { id: formId }; }),
    submissions: adminProcedure.input(z.object({ formId: z.number().optional() }).optional()).query(({ input }) => listSubmissions(input?.formId)),
    submission: adminProcedure.input(z.object({ id: z.number() })).query(({ input }) => getSubmission(input.id)),
    saveIntegration: adminProcedure.input(z.object({ formId: z.number(), channelName: z.string().min(1).max(200), notificationCode: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/), endpointUrl: z.string().url().max(500).optional(), enabled: z.boolean() })).mutation(async ({ input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const current = await getIntegration(input.formId); const values = { formId: input.formId, channelName: input.channelName, notificationCode: input.notificationCode, endpointUrl: input.endpointUrl ?? ENV.vpsBotApiUrl, enabled: input.enabled ? 1 : 0 }; if (!values.endpointUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "サーバー側のBot API設定が未完了です。" }); if (current) await db.update(integrations).set(values).where(eq(integrations.formId, input.formId)); else await db.insert(integrations).values(values); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
