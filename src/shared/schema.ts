import { sql } from "drizzle-orm"
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"
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
