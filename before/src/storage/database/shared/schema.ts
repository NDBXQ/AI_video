import { pgTable, type PgTable, index, foreignKey, unique, varchar, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 128 }).notNull(),
	email: varchar({ length: 255 }),
	avatarUrl: text("avatar_url"),
	isActive: boolean("is_active").default(true).notNull(),
	metadata: text(),
	currentStoryId: varchar("current_story_id", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_email_unique").on(table.email),
] as const);

export const stories = pgTable("stories", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	title: varchar({ length: 255 }),
	storyType: varchar("story_type", { length: 20 }),
	storyText: text("story_text").notNull(),
	generatedText: text("generated_text"),
	runId: text("run_id"),
	status: varchar({ length: 20 }).default('draft').notNull(),
	progressStage: varchar("progress_stage", { length: 20 }).default('outline').notNull(), // 'outline' | 'text' | 'script' | 'completed'
	aspectRatio: varchar("aspect_ratio", { length: 10 }).default('16:9').notNull(),
	resolution: varchar({ length: 15 }).default('1920x1080').notNull(),
	resolutionPreset: varchar("resolution_preset", { length: 10 }).default('1080p').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("stories_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "stories_user_id_fkey"
		}).onDelete("cascade"),
] as const);

export const storyOutlines = pgTable("story_outlines", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	storyId: varchar("story_id", { length: 36 }).notNull(),
	sequence: integer().notNull(),
	outlineText: text("outline_text").notNull(),
	originalText: text("original_text").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("story_outlines_story_id_idx").using("btree", table.storyId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_outlines_story_id_fkey"
		}).onDelete("cascade"),
] as const);

export const storyboardTexts = pgTable("storyboard_texts", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	outlineId: varchar("outline_id", { length: 36 }).notNull(),
	sequence: integer().notNull(),
	sceneTitle: text("scene_title").notNull(),
	shotCut: boolean("shot_cut").default(false).notNull(), // 是否切镜
	storyboardText: text("storyboard_text").notNull(), // 分镜文本内容
	originalText: text("original_text").notNull(),
	isCreatedReference: boolean("is_created_reference").default(false).notNull(), // 是否已生成参考图
	isVideoGenerated: boolean("is_video_generated").default(false).notNull(),
	isScriptGenerated: boolean("is_script_generated").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("storyboard_texts_outline_id_idx").using("btree", table.outlineId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.outlineId],
			foreignColumns: [storyOutlines.id],
			name: "storyboard_texts_outline_id_fkey"
		}).onDelete("cascade"),
] as const);

export const storyboardScripts = pgTable("storyboard_scripts", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	storyboardTextId: varchar("storyboard_text_id", { length: 36 }).notNull(),
	sequence: integer().notNull(),
	scriptContent: text("script_content").notNull(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("storyboard_scripts_text_id_idx").using("btree", table.storyboardTextId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storyboardTextId],
			foreignColumns: [storyboardTexts.id],
			name: "storyboard_scripts_text_id_fkey"
		}).onDelete("cascade"),
] as const);

export const prompts = pgTable("prompts", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	storyboardId: varchar("storyboard_id", { length: 36 }).notNull(), // storyboardTextId
	videoPrompt: text("video_prompt"), // 视频生成提示词
	imagePromptType: varchar("image_prompt_type", { length: 50 }), // 图片提示词类型，如"首帧"
	imagePrompt: text("image_prompt"), // 图片生成提示词
	runId: text("run_id"), // 运行ID
	scriptJson: text("script_json"), // 原始脚本JSON数据
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("prompts_storyboard_id_idx").using("btree", table.storyboardId.asc().nullsLast().op("text_ops")),
] as const);

export const generatedImages = pgTable("generated_images", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	storyId: varchar("story_id", { length: 36 }).notNull(),
	name: text().notNull(), // 图片名字
	description: text(), // 图片描述（description字段内容）
	url: text().notNull(), // 原图对象存储URL
	storageKey: text("storage_key").notNull(), // 原图对象存储key
	thumbnailUrl: text("thumbnail_url"), // 缩略图对象存储URL
	thumbnailStorageKey: text("thumbnail_storage_key"), // 缩略图对象存储key
	category: varchar("category", { length: 20 }).notNull(), // 'background' | 'role' | 'item'
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("generated_images_story_id_idx").using("btree", table.storyId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "generated_images_story_id_fkey"
		}).onDelete("cascade"),
] as const);

export const generatedVideos = pgTable("generated_videos", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	storyId: varchar("story_id", { length: 36 }).notNull(),
	storyboardId: varchar("storyboard_id", { length: 36 }).notNull(), // storyboardTextId
	name: text().notNull(), // 视频名称
	description: text().notNull().default(''), // 视频描述（video_prompt字段内容），默认空字符串
	url: text().notNull(), // 原视频对象存储URL
	storageKey: text("storage_key").notNull(), // 原视频对象存储key
	thumbnailUrl: text("thumbnail_url").notNull().default(''), // 缩略图对象存储URL，默认空字符串
	thumbnailStorageKey: text("thumbnail_storage_key").notNull().default(''), // 缩略图对象存储key，默认空字符串
	duration: integer().notNull().default(0), // 视频时长（秒），默认0
	mode: varchar({ length: 20 }).notNull(), // '首帧' | '尾帧'
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("generated_videos_story_id_idx").using("btree", table.storyId.asc().nullsLast().op("text_ops")),
	index("generated_videos_storyboard_id_idx").using("btree", table.storyboardId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "generated_videos_story_id_fkey"
		}).onDelete("cascade"),
] as const);

export const libraryAssets = pgTable("library_assets", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }),
	type: varchar({ length: 20 }).notNull(), // 'image' | 'video' | 'audio'
	source: varchar({ length: 20 }).notNull(), // 'upload' | 'ai'
	title: text(),
	prompt: text(),
	tags: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
	mimeType: varchar("mime_type", { length: 128 }),
	size: integer(),
	url: text().notNull(),
	storageKey: text("storage_key").notNull(),
	thumbnailUrl: text("thumbnail_url"),
	thumbnailStorageKey: text("thumbnail_storage_key"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("library_assets_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("library_assets_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
] as const);

export const publicResources = pgTable("public_resources", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	type: varchar({ length: 20 }).notNull(), // 'character' | 'background' | 'props' | 'music' | 'effect' | 'transition'
	source: varchar({ length: 20 }).notNull(), // 'seed' | 'upload' | 'ai'
	name: text().notNull(),
	description: text().notNull().default(''),
	previewUrl: text("preview_url").notNull(),
	previewStorageKey: text("preview_storage_key"),
	originalUrl: text("original_url"),
	originalStorageKey: text("original_storage_key"),
	tags: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
	applicableScenes: jsonb("applicable_scenes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("public_resources_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
] as const);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Zod schemas for users
export const insertUserSchema = createCoercedInsertSchema(users).pick({
  name: true,
  email: true,
  avatarUrl: true,
  currentStoryId: true,
});

export const updateUserSchema = createCoercedInsertSchema(users)
  .pick({
    name: true,
    email: true,
    avatarUrl: true,
    currentStoryId: true,
  })
  .partial();

// Zod schemas for stories
export const insertStorySchema = createCoercedInsertSchema(stories)
  .pick({
    userId: true,
    title: true,
    storyType: true,
    storyText: true,
    generatedText: true,
    runId: true,
    status: true,
    progressStage: true,
    aspectRatio: true,
    resolution: true,
    resolutionPreset: true,
  })
  .partial({ aspectRatio: true, resolution: true, resolutionPreset: true });

export const updateStorySchema = createCoercedInsertSchema(stories)
  .pick({
    title: true,
    generatedText: true,
    runId: true,
    status: true,
    progressStage: true,
    aspectRatio: true,
    resolution: true,
    resolutionPreset: true,
  })
  .partial();

// Zod schemas for storyOutlines
export const insertStoryOutlineSchema = createCoercedInsertSchema(
  storyOutlines
).pick({
  storyId: true,
  sequence: true,
  outlineText: true,
  originalText: true,
});

export const updateStoryOutlineSchema = createCoercedInsertSchema(storyOutlines)
  .pick({
    outlineText: true,
  })
  .partial();

// Zod schemas for storyboardTexts
export const insertStoryboardTextSchema = createCoercedInsertSchema(
  storyboardTexts
).pick({
  outlineId: true,
  sequence: true,
  sceneTitle: true,
  shotCut: true,
  storyboardText: true,
  originalText: true,
});

export const updateStoryboardTextSchema = createCoercedInsertSchema(storyboardTexts)
  .pick({
    sceneTitle: true,
    shotCut: true,
    storyboardText: true,
    originalText: true,
    isCreatedReference: true,
    isVideoGenerated: true,
    isScriptGenerated: true,
  })
  .partial();

// Zod schemas for storyboardScripts
export const insertStoryboardScriptSchema = createCoercedInsertSchema(
  storyboardScripts
).pick({
  storyboardTextId: true,
  sequence: true,
  scriptContent: true,
  imageUrl: true,
});

export const updateStoryboardScriptSchema = createCoercedInsertSchema(storyboardScripts)
  .pick({
    scriptContent: true,
    imageUrl: true,
  })
  .partial();

// Zod schemas for prompts
export const insertPromptSchema = createCoercedInsertSchema(prompts)
  .pick({
    storyboardId: true,
    videoPrompt: true,
    imagePromptType: true,
    imagePrompt: true,
    runId: true,
    scriptJson: true,
  })
  .partial({ videoPrompt: true, imagePromptType: true, imagePrompt: true, runId: true, scriptJson: true }); // 所有字段都可为空

export const updatePromptSchema = createCoercedInsertSchema(prompts)
  .pick({
    videoPrompt: true,
    imagePromptType: true,
    imagePrompt: true,
    runId: true,
    scriptJson: true,
  })
  .partial();

// Zod schemas for generatedImages
export const insertGeneratedImageSchema = createCoercedInsertSchema(generatedImages)
  .pick({
    storyId: true,
    name: true,
    description: true,
    url: true,
    storageKey: true,
    thumbnailUrl: true,
    thumbnailStorageKey: true,
    category: true,
  })
  .partial({ description: true, thumbnailUrl: true, thumbnailStorageKey: true }); // description 和缩略图字段可为空

export const updateGeneratedImageSchema = createCoercedInsertSchema(generatedImages)
  .pick({
    name: true,
    description: true,
    url: true,
    storageKey: true,
    thumbnailUrl: true,
    thumbnailStorageKey: true,
    category: true,
  })
  .partial();

// Zod schemas for generatedVideos
export const insertGeneratedVideoSchema = createCoercedInsertSchema(generatedVideos)
  .pick({
    storyId: true,
    storyboardId: true,
    name: true,
    description: true,
    url: true,
    storageKey: true,
    mode: true,
  });

export const updateGeneratedVideoSchema = createCoercedInsertSchema(generatedVideos)
  .pick({
    name: true,
    description: true,
    url: true,
    storageKey: true,
    thumbnailUrl: true,
    thumbnailStorageKey: true,
    duration: true,
    mode: true,
  })
  .partial();

export const insertLibraryAssetSchema = createCoercedInsertSchema(libraryAssets)
  .pick({
    userId: true,
    type: true,
    source: true,
    title: true,
    prompt: true,
    tags: true,
    mimeType: true,
    size: true,
    url: true,
    storageKey: true,
    thumbnailUrl: true,
    thumbnailStorageKey: true,
  })
  .partial({
    userId: true,
    title: true,
    prompt: true,
    tags: true,
    mimeType: true,
    size: true,
    thumbnailUrl: true,
    thumbnailStorageKey: true,
  });

export const updateLibraryAssetSchema = createCoercedInsertSchema(libraryAssets)
  .pick({
    title: true,
    prompt: true,
    tags: true,
  })
  .partial();

export const insertPublicResourceSchema = createCoercedInsertSchema(publicResources)
  .pick({
    type: true,
    source: true,
    name: true,
    description: true,
    previewUrl: true,
    previewStorageKey: true,
    originalUrl: true,
    originalStorageKey: true,
    tags: true,
    applicableScenes: true,
  })
  .partial({
    description: true,
    previewStorageKey: true,
    originalUrl: true,
    originalStorageKey: true,
    tags: true,
    applicableScenes: true,
  });

export const updatePublicResourceSchema = createCoercedInsertSchema(publicResources)
  .pick({
    name: true,
    description: true,
    tags: true,
    applicableScenes: true,
  })
  .partial();

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type UpdateStory = z.infer<typeof updateStorySchema>;

export type StoryOutline = typeof storyOutlines.$inferSelect;
export type InsertStoryOutline = z.infer<typeof insertStoryOutlineSchema>;
export type UpdateStoryOutline = z.infer<typeof updateStoryOutlineSchema>;

export type StoryboardText = typeof storyboardTexts.$inferSelect;
export type InsertStoryboardText = z.infer<typeof insertStoryboardTextSchema>;
export type UpdateStoryboardText = z.infer<typeof updateStoryboardTextSchema>;

export type StoryboardScript = typeof storyboardScripts.$inferSelect;
export type InsertStoryboardScript = z.infer<typeof insertStoryboardScriptSchema>;
export type UpdateStoryboardScript = z.infer<typeof updateStoryboardScriptSchema>;

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type UpdatePrompt = z.infer<typeof updatePromptSchema>;

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type UpdateGeneratedImage = z.infer<typeof updateGeneratedImageSchema>;

export type GeneratedVideo = typeof generatedVideos.$inferSelect;
export type InsertGeneratedVideo = z.infer<typeof insertGeneratedVideoSchema>;
export type UpdateGeneratedVideo = z.infer<typeof updateGeneratedVideoSchema>;

export type LibraryAsset = typeof libraryAssets.$inferSelect;
export type InsertLibraryAsset = z.infer<typeof insertLibraryAssetSchema>;
export type UpdateLibraryAsset = z.infer<typeof updateLibraryAssetSchema>;

export type PublicResource = typeof publicResources.$inferSelect;
export type InsertPublicResource = z.infer<typeof insertPublicResourceSchema>;
export type UpdatePublicResource = z.infer<typeof updatePublicResourceSchema>;
