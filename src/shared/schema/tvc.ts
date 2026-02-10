import { sql } from "drizzle-orm"
import { boolean, integer, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core"

import type { StoryboardScriptContent } from "./story"

const tvc = pgSchema("tvc")

export const tvcStories = tvc.table("stories", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title"),
  storyType: text("story_type"),
  resolution: text("resolution").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  shotStyle: text("style").notNull().default("cinema"),
  storyText: text("story_text").notNull(),
  generatedText: text("generated_text"),
  finalVideoUrl: text("final_video_url"),
  status: text("status").notNull().default("draft"),
  progressStage: text("progress_stage").notNull().default("outline"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
})

export const tvcStoryOutlines = tvc.table("story_outlines", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => tvcStories.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  outlineText: text("outline_text").notNull(),
  originalText: text("original_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const tvcStoryboards = tvc.table("storyboards", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  outlineId: text("outline_id").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  shotCut: boolean("shot_cut").notNull().default(false),
  storyboardText: text("storyboard_text").notNull().default(""),
  scriptContent: jsonb("script_content").$type<StoryboardScriptContent | null>(),
  frames: jsonb("frames")
    .$type<{
      first?: { url?: string | null; thumbnailUrl?: string | null; prompt?: string | null }
      last?: { url?: string | null; thumbnailUrl?: string | null; prompt?: string | null }
    }>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  videoInfo: jsonb("video_info")
    .$type<{
      url?: string | null
      prompt?: string | null
      storageKey?: string | null
      durationSeconds?: number | null
      settings?: {
        mode?: string | null
        generateAudio?: boolean | null
        watermark?: boolean | null
      }
    }>()
    .notNull()
    .default(sql`'{}'::jsonb`)
})

export const tvcChatMessages = tvc.table("chat_messages", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => tvcStories.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const tvcLlmMessages = tvc.table("llm_messages", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => tvcStories.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull().default(0),
  role: text("role").notNull(),
  content: text("content").notNull(),
  name: text("name"),
  toolCallId: text("tool_call_id"),
  toolCalls: jsonb("tool_calls").$type<Array<Record<string, unknown>> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const tvcJobs = tvc.table("jobs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  progressVersion: integer("progress_version").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
})

export const tvcAssets = tvc.table("assets", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => tvcStories.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  assetOrdinal: integer("asset_ordinal").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailStorageKey: text("thumbnail_storage_key"),
  mimeType: text("mime_type"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
})

export type TvcStory = typeof tvcStories.$inferSelect
export type TvcStoryOutline = typeof tvcStoryOutlines.$inferSelect
export type TvcStoryboard = typeof tvcStoryboards.$inferSelect
export type TvcChatMessageRow = typeof tvcChatMessages.$inferSelect
export type TvcLlmMessageRow = typeof tvcLlmMessages.$inferSelect
export type TvcJob = typeof tvcJobs.$inferSelect
export type TvcAsset = typeof tvcAssets.$inferSelect
