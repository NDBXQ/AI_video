import { sql } from "drizzle-orm"
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const publicResources = pgTable("public_resources", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  type: text("type").notNull(),
  source: text("source").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  previewUrl: text("preview_url").notNull(),
  previewStorageKey: text("preview_storage_key"),
  originalUrl: text("original_url"),
  originalStorageKey: text("original_storage_key"),
  durationMs: integer("duration_ms"),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  applicableScenes: jsonb("applicable_scenes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const sharedResources = pgTable("shared_resources", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  source: text("source").notNull(),
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

export const insertPublicResourceSchema = createInsertSchema(publicResources, {
  name: z.string().min(1),
  type: z.enum(["character", "background", "props", "audio", "music", "effect", "transition", "video"]),
  source: z.enum(["seed", "upload", "ai"]),
  durationMs: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string()).optional(),
  applicableScenes: z.array(z.string()).optional()
})

export const insertSharedResourceSchema = createInsertSchema(sharedResources, {
  name: z.string().min(1),
  type: z.enum(["character", "background", "props", "audio", "music", "effect", "transition", "video"]),
  source: z.enum(["seed"]),
  tags: z.array(z.string()).optional(),
  applicableScenes: z.array(z.string()).optional()
})

export type PublicResource = typeof publicResources.$inferSelect
export type SharedResource = typeof sharedResources.$inferSelect
export type InsertPublicResource = z.infer<typeof insertPublicResourceSchema>
export type InsertSharedResource = z.infer<typeof insertSharedResourceSchema>
