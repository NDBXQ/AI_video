import { relations } from "drizzle-orm/relations";
import { stories, users, storyOutlines, storyboardTexts, storyboardScripts } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	story: one(stories, {
		fields: [users.currentStoryId],
		references: [stories.id],
		relationName: "users_currentStoryId_stories_id"
	}),
	stories: many(stories, {
		relationName: "stories_userId_users_id"
	}),
}));

export const storiesRelations = relations(stories, ({one, many}) => ({
	users: many(users, {
		relationName: "users_currentStoryId_stories_id"
	}),
	user: one(users, {
		fields: [stories.userId],
		references: [users.id],
		relationName: "stories_userId_users_id"
	}),
	storyOutlines: many(storyOutlines),
}));

export const storyOutlinesRelations = relations(storyOutlines, ({one, many}) => ({
	story: one(stories, {
		fields: [storyOutlines.storyId],
		references: [stories.id]
	}),
	storyboardTexts: many(storyboardTexts),
}));

export const storyboardTextsRelations = relations(storyboardTexts, ({one, many}) => ({
	outline: one(storyOutlines, {
		fields: [storyboardTexts.outlineId],
		references: [storyOutlines.id]
	}),
	storyboardScripts: many(storyboardScripts),
}));

export const storyboardScriptsRelations = relations(storyboardScripts, ({one}) => ({
	storyboardText: one(storyboardTexts, {
		fields: [storyboardScripts.storyboardTextId],
		references: [storyboardTexts.id]
	}),
}));