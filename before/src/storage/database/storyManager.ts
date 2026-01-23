import { eq, and, desc, or, ne } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { stories, insertStorySchema, updateStorySchema } from "./shared/schema";
import type { Story, InsertStory, UpdateStory } from "./shared/schema";

export class StoryManager {
  /**
   * 创建新故事
   */
  async createStory(data: InsertStory): Promise<Story> {
    const db = await getDb();
    const validated = insertStorySchema.parse({
      ...data,
      progressStage: data.progressStage || 'outline', // 默认为 outline 阶段
    });
    const [story] = await db.insert(stories).values(validated).returning();
    return story;
  }

  /**
   * 根据 ID 获取故事
   */
  async getStoryById(id: string): Promise<Story | null> {
    const db = await getDb();
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    return story || null;
  }

  /**
   * 获取用户的所有故事
   */
  async getStoriesByUserId(userId: string): Promise<Story[]> {
    const db = await getDb();
    return db
      .select()
      .from(stories)
      .where(eq(stories.userId, userId))
      .orderBy(desc(stories.createdAt));
  }

  /**
   * 获取所有故事
   */
  async getAllStories(): Promise<Story[]> {
    const db = await getDb();
    return db
      .select()
      .from(stories)
      .orderBy(desc(stories.createdAt));
  }

  /**
   * 获取用户的草稿作品（未完成）
   */
  async getDraftsByUserId(userId: string): Promise<Story[]> {
    const db = await getDb();
    return db
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.userId, userId),
          ne(stories.progressStage, 'completed')
        )
      )
      .orderBy(desc(stories.createdAt));
  }

  /**
   * 获取用户的成品作品（已完成）
   */
  async getCompletedByUserId(userId: string): Promise<Story[]> {
    const db = await getDb();
    return db
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.userId, userId),
          eq(stories.progressStage, 'completed')
        )
      )
      .orderBy(desc(stories.createdAt));
  }

  /**
   * 更新故事
   */
  async updateStory(id: string, data: UpdateStory): Promise<Story | null> {
    const db = await getDb();
    const validated = updateStorySchema.parse(data);
    const [story] = await db
      .update(stories)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(stories.id, id))
      .returning();
    return story || null;
  }

  /**
   * 更新故事进度阶段
   */
  async updateProgressStage(id: string, stage: 'outline' | 'text' | 'script' | 'completed'): Promise<Story | null> {
    return this.updateStory(id, { progressStage: stage });
  }

  /**
   * 删除故事
   */
  async deleteStory(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(stories).where(eq(stories.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storyManager = new StoryManager();
