import { sql } from "drizzle-orm"
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

import { stories, storyboards } from "./story"

export const generatedImages = pgTable("generated_images", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  storyboardId: text("storyboard_id").references(() => storyboards.id, { onDelete: "cascade" }),
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

export const generatedAudios = pgTable("generated_audios", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  storyboardId: text("storyboard_id").references(() => storyboards.id, { onDelete: "cascade" }),
  roleName: text("role_name").notNull(),
  speakerId: text("speaker_id").notNull(),
  speakerName: text("speaker_name").notNull(),
  content: text("content").notNull(),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  audioSize: integer("audio_size").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const ttsSpeakerSamples = pgTable("tts_speaker_samples", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  speakerId: text("speaker_id").notNull(),
  speakerName: text("speaker_name").notNull(),
  sampleText: text("sample_text").notNull(),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  audioSize: integer("audio_size").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const insertGeneratedImageSchema = createInsertSchema(generatedImages, {
  name: z.string().min(1),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  thumbnailStorageKey: z.string().optional(),
  prompt: z.string().optional()
})

export type GeneratedImage = typeof generatedImages.$inferSelect
export type GeneratedAudio = typeof generatedAudios.$inferSelect
export type TtsSpeakerSample = typeof ttsSpeakerSamples.$inferSelect
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>
