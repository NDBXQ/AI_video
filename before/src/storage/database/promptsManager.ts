import { prompts, insertPromptSchema, updatePromptSchema } from './shared/schema';
import { desc, eq } from 'drizzle-orm';
import { getDb } from 'coze-coding-dev-sdk';
import type { Prompt, InsertPrompt, UpdatePrompt } from './shared/schema';

export const promptsManager = {
  /**
   * 根据storyboardId获取提示词记录
   */
  async getPromptByStoryboardId(storyboardId: string): Promise<Prompt | null> {
    const db = await getDb();
    const records = await db
      .select()
      .from(prompts)
      .where(eq(prompts.storyboardId, storyboardId))
      .orderBy(desc(prompts.createdAt))
      .limit(1);
    return records[0] || null;
  },

  /**
   * 创建提示词记录
   */
  async createPrompt(data: InsertPrompt): Promise<Prompt> {
    const db = await getDb();
    const validated = insertPromptSchema.parse(data);
    const [record] = await db.insert(prompts).values(validated).returning();
    return record;
  },

  /**
   * 更新提示词记录
   */
  async updatePrompt(id: string, data: UpdatePrompt): Promise<Prompt | null> {
    const db = await getDb();
    const validated = updatePromptSchema.parse(data);
    const [record] = await db
      .update(prompts)
      .set(validated)
      .where(eq(prompts.id, id))
      .returning();

    return record || null;
  },
};
