import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const forms = mysqlTable("forms", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "open", "closed"]).default("draft").notNull(),
  successMessage: varchar("successMessage", { length: 500 }).default("回答を受け付けました。ありがとうございました。"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  label: varchar("label", { length: 300 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["short_text", "long_text", "email", "single_choice", "multiple_choice"]).notNull(),
  options: text("options"),
  required: int("required").default(0).notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  status: mysqlEnum("status", ["received", "sent", "failed"]).default("received").notNull(),
  submitterMeta: text("submitterMeta"),
  botError: text("botError"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  questionId: int("questionId").notNull(),
  value: text("value").notNull(),
});

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull().unique(),
  guildId: varchar("guildId", { length: 32 }),
  channelId: varchar("channelId", { length: 32 }),
  channelName: varchar("channelName", { length: 200 }).notNull(),
  notificationCode: varchar("notificationCode", { length: 64 }).notNull().default(""),
  endpointUrl: varchar("endpointUrl", { length: 500 }).notNull(),
  enabled: int("enabled").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Form = typeof forms.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
