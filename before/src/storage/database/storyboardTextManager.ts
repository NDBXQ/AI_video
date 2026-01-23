import { eq, and, desc } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { storyboardTexts, insertStoryboardTextSchema, updateStoryboardTextSchema } from "./shared/schema";
import type { StoryboardText, InsertStoryboardText, UpdateStoryboardText } from "./shared/schema";

export class StoryboardTextManager {
  /**
   * 创建分镜文本
   */
  async createStoryboardText(data: InsertStoryboardText): Promise<StoryboardText> {
    console.log('createStoryboardText 调用，输入数据:', JSON.stringify(data, null, 2));
    const db = await getDb();
    console.log('数据库连接成功');

    const validated = insertStoryboardTextSchema.parse(data);
    console.log('数据验证通过:', JSON.stringify(validated, null, 2));

    const [storyboardText] = await db.insert(storyboardTexts).values(validated).returning();
    console.log('数据库插入成功，返回数据:', JSON.stringify(storyboardText, null, 2));

    return storyboardText;
  }

  /**
   * 批量创建分镜文本
   */
  async createStoryboardTexts(data: InsertStoryboardText[]): Promise<StoryboardText[]> {
    const db = await getDb();
    const validated = data.map((item) => insertStoryboardTextSchema.parse(item));
    const texts = await db.insert(storyboardTexts).values(validated).returning();
    return texts;
  }

  /**
   * 根据 outlineId 获取所有分镜文本
   */
  async getStoryboardTextsByOutlineId(outlineId: string): Promise<StoryboardText[]> {
    const db = await getDb();
    return db
      .select()
      .from(storyboardTexts)
      .where(eq(storyboardTexts.outlineId, outlineId))
      .orderBy(storyboardTexts.sequence);
  }

  /**
   * 根据 ID 获取分镜文本
   */
  async getStoryboardTextById(id: string): Promise<StoryboardText | null> {
    const db = await getDb();
    const [text] = await db.select().from(storyboardTexts).where(eq(storyboardTexts.id, id));
    return text || null;
  }

  /**
   * 根据序号获取指定大纲的分镜文本
   */
  async getStoryboardTextBySequence(outlineId: string, sequence: number): Promise<StoryboardText | null> {
    const db = await getDb();
    const [text] = await db
      .select()
      .from(storyboardTexts)
      .where(
        and(
          eq(storyboardTexts.outlineId, outlineId),
          eq(storyboardTexts.sequence, sequence)
        )
      );
    return text || null;
  }

  /**
   * 更新分镜文本
   */
  async updateStoryboardText(id: string, data: UpdateStoryboardText): Promise<StoryboardText | null> {
    const db = await getDb();
    const validated = updateStoryboardTextSchema.parse(data);
    const [text] = await db
      .update(storyboardTexts)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(storyboardTexts.id, id))
      .returning();
    return text || null;
  }

  /**
   * 删除大纲的所有分镜文本
   */
  async deleteStoryboardTextsByOutlineId(outlineId: string): Promise<number> {
    const db = await getDb();
    const result = await db.delete(storyboardTexts).where(eq(storyboardTexts.outlineId, outlineId));
    return result.rowCount ?? 0;
  }

  /**
   * 删除单个分镜文本
   */
  async deleteStoryboardText(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(storyboardTexts).where(eq(storyboardTexts.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storyboardTextManager = new StoryboardTextManager();
