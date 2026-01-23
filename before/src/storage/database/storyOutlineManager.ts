import { eq, and, desc } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { storyOutlines, insertStoryOutlineSchema } from "./shared/schema";
import type { StoryOutline, InsertStoryOutline } from "./shared/schema";

export class StoryOutlineManager {
  /**
   * 创建故事大纲
   */
  async createOutline(data: InsertStoryOutline): Promise<StoryOutline> {
    const db = await getDb();
    const validated = insertStoryOutlineSchema.parse(data);
    const [outline] = await db.insert(storyOutlines).values(validated).returning();
    return outline;
  }

  /**
   * 批量创建故事大纲
   */
  async createOutlines(data: InsertStoryOutline[]): Promise<StoryOutline[]> {
    const db = await getDb();
    const validated = data.map((item) => insertStoryOutlineSchema.parse(item));
    const outlines = await db.insert(storyOutlines).values(validated).returning();
    return outlines;
  }

  /**
   * 根据 storyId 获取所有大纲
   */
  async getOutlinesByStoryId(storyId: string): Promise<StoryOutline[]> {
    const db = await getDb();
    return db
      .select()
      .from(storyOutlines)
      .where(eq(storyOutlines.storyId, storyId))
      .orderBy(storyOutlines.sequence);
  }

  /**
   * 根据 ID 获取大纲
   */
  async getOutlineById(id: string): Promise<StoryOutline | null> {
    const db = await getDb();
    const [outline] = await db.select().from(storyOutlines).where(eq(storyOutlines.id, id));
    return outline || null;
  }

  /**
   * 删除故事的所有大纲
   */
  async deleteOutlinesByStoryId(storyId: string): Promise<number> {
    const db = await getDb();
    const result = await db.delete(storyOutlines).where(eq(storyOutlines.storyId, storyId));
    return result.rowCount ?? 0;
  }
}

export const storyOutlineManager = new StoryOutlineManager();
