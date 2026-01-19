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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

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
  scriptContent: jsonb("script_content")
})

export type Story = typeof stories.$inferSelect
export type StoryOutline = typeof storyOutlines.$inferSelect
export type Storyboard = typeof storyboards.$inferSelect
