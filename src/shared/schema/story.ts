import { sql } from "drizzle-orm"
import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const stories = pgTable("stories", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title"),
  storyType: text("story_type"),
  resolution: text("resolution").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  shotStyle: text("style").notNull().default("realistic"),
  storyText: text("story_text").notNull(),
  generatedText: text("generated_text"),
  finalVideoUrl: text("final_video_url"),
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

export type Story = typeof stories.$inferSelect
export type StoryOutline = typeof storyOutlines.$inferSelect
export type Storyboard = typeof storyboards.$inferSelect
