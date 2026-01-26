import { sql } from "drizzle-orm"
import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema, createUpdateSchema } from "drizzle-zod"
import { z } from "zod"

export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  password: text("password").notNull()
})

export const insertUserSchema = createInsertSchema(users, {
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().min(1).max(200).optional(),
  password: z.string().min(1)
})

export const updateUserSchema = createUpdateSchema(users, {
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().min(1).max(200).optional(),
  password: z.string().min(1).optional()
})

export type User = typeof users.$inferSelect
export type InsertUser = typeof users.$inferInsert
export type UpdateUser = z.infer<typeof updateUserSchema>

export const stories = pgTable("stories", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title"),
  storyType: text("story_type"),
  resolution: text("resolution").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  shotStyle: text("style").notNull().default("cinema"),
  storyText: text("story_text").notNull(),
  generatedText: text("generated_text"),
  status: text("status").notNull().default("draft"),
  progressStage: text("progress_stage").notNull().default("outline"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
})

export const storyOutlines = pgTable("story_outlines", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  outlineText: text("outline_text").notNull(),
  originalText: text("original_text").notNull(),
  outlineDrafts: jsonb("outline_drafts")
    .$type<Array<{ id: string; title?: string | null; content: string; requirements?: string | null; createdAt: string }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  activeOutlineDraftId: text("active_outline_draft_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type StoryboardScriptContent = {
  shot_info: {
    cut_to: boolean
    shot_style: string
    shot_duration: number
  }
  shot_content: {
    bgm: string
    roles: Array<{
      speak: null | {
        tone: string
        speed: number
        content: string
        emotion: string
        time_point: number
      }
      action: string
      role_name: string
      expression: string
      location_info: string
      appearance_time_point: number
    }>
    shoot: {
      angle: string
      shot_angle: string
      camera_movement: string
    }
    background: {
      status: string
      background_name: string
    }
    role_items: string[]
    other_items: string[]
  }
  video_content: {
    items: Array<{
      relation: string
      item_name: string
      description: string
      reference_image_name?: string
      reference_image_description?: string
    }>
    roles: Array<{
      role_name: string
      description: string
      reference_image_name?: string
      reference_image_description?: string
    }>
    background: {
      description: string
      background_name: string
      reference_image_name?: string
      reference_image_description?: string
    }
    other_items: Array<{
      relation: string
      item_name: string
      description: string
      reference_image_name?: string
      reference_image_description?: string
    }>
  }
}

export const storyboards = pgTable("storyboards", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  outlineId: text("outline_id").notNull(),
  sequence: integer("sequence").notNull(),
  sceneTitle: text("scene_title").notNull(),
  originalText: text("original_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  isReferenceGenerated: boolean("is_reference_generated").notNull().default(false),
  shotCut: boolean("shot_cut").notNull().default(false),
  storyboardText: text("storyboard_text").notNull().default(""),
  isVideoGenerated: boolean("is_video_generated").notNull().default(false),
  isScriptGenerated: boolean("is_script_generated").notNull().default(false),
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

export const generatedImages = pgTable("generated_images", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  storyboardId: text("storyboard_id")
    .references(() => storyboards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailStorageKey: text("thumbnail_storage_key"),
  category: text("category").notNull().default("reference"),
  prompt: text("prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  storyId: text("story_id")
    .references(() => stories.id, { onDelete: "cascade" }),
  storyboardId: text("storyboard_id")
    .references(() => storyboards.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  progressVersion: integer("progress_version").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
})

export const publicResources = pgTable("public_resources", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'character' | 'background' | 'props' | 'audio' | 'music' | 'effect' | 'transition' | 'video'
  source: text("source").notNull(), // 'seed' | 'upload' | 'ai'
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  previewUrl: text("preview_url").notNull(),
  previewStorageKey: text("preview_storage_key"),
  originalUrl: text("original_url"),
  originalStorageKey: text("original_storage_key"),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  applicableScenes: jsonb("applicable_scenes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type Story = typeof stories.$inferSelect
export type StoryOutline = typeof storyOutlines.$inferSelect
export type Storyboard = typeof storyboards.$inferSelect
export type GeneratedImage = typeof generatedImages.$inferSelect
export type Job = typeof jobs.$inferSelect
export type PublicResource = typeof publicResources.$inferSelect

export const insertGeneratedImageSchema = createInsertSchema(generatedImages, {
  name: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  thumbnailStorageKey: z.string().optional(),
  prompt: z.string().optional()
})

export const insertPublicResourceSchema = createInsertSchema(publicResources, {
  name: z.string().min(1),
  type: z.enum(["character", "background", "props", "audio", "music", "effect", "transition", "video"]),
  source: z.enum(['seed', 'upload', 'ai']),
  tags: z.array(z.string()).optional(),
  applicableScenes: z.array(z.string()).optional()
})

export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>
export type InsertPublicResource = z.infer<typeof insertPublicResourceSchema>
