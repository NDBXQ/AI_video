import { sql } from "drizzle-orm"
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { stories, storyboards } from "./story"

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  storyId: text("story_id").references(() => stories.id, { onDelete: "cascade" }),
  storyboardId: text("storyboard_id").references(() => storyboards.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  progressVersion: integer("progress_version").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
})

export type Job = typeof jobs.$inferSelect
