import { sql } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const telemetryEvents = pgTable("telemetry_events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  userId: text("user_id"),
  page: text("page").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const iterationTasks = pgTable("iteration_tasks", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  module: text("module").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("proposed"),
  spec: jsonb("spec").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
})

export type TelemetryEvent = typeof telemetryEvents.$inferSelect
export type IterationTask = typeof iterationTasks.$inferSelect
