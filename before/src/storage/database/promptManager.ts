import { eq } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { prompts, insertPromptSchema, updatePromptSchema } from "./shared/schema";
import type { Prompt, InsertPrompt, UpdatePrompt } from "./shared/schema";

export class PromptManager {
  /**
   * 创建提示词
   */
  async createPrompt(data: InsertPrompt): Promise<Prompt> {
    const db = await getDb();
    const validated = insertPromptSchema.parse(data);
    const [prompt] = await db.insert(prompts).values(validated).returning();
    return prompt;
  }

  /**
   * 根据 storyboardId 获取提示词
   */
  async getPromptByStoryboardId(storyboardId: string): Promise<Prompt | null> {
    const db = await getDb();
    const [prompt] = await db.select().from(prompts).where(eq(prompts.storyboardId, storyboardId));
    return prompt || null;
  }

  /**
   * 根据 ID 获取提示词
   */
  async getPromptById(id: string): Promise<Prompt | null> {
    const db = await getDb();
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id));
    return prompt || null;
  }

  /**
   * 更新提示词
   */
  async updatePrompt(id: string, data: UpdatePrompt): Promise<Prompt | null> {
    const db = await getDb();
    const validated = updatePromptSchema.parse(data);
    const [prompt] = await db
      .update(prompts)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(prompts.id, id))
      .returning();
    return prompt || null;
  }

  /**
   * 根据 storyboardId 更新提示词
   */
  async updatePromptByStoryboardId(storyboardId: string, data: UpdatePrompt): Promise<Prompt | null> {
    const db = await getDb();
    const validated = updatePromptSchema.parse(data);
    const [prompt] = await db
      .update(prompts)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(prompts.storyboardId, storyboardId))
      .returning();
    return prompt || null;
  }

  /**
   * 删除提示词
   */
  async deletePrompt(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(prompts).where(eq(prompts.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 根据 storyboardId 删除提示词
   */
  async deletePromptByStoryboardId(storyboardId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(prompts).where(eq(prompts.storyboardId, storyboardId)).returning();
    return result.length > 0;
  }
}

// 导出单例
export const promptManager = new PromptManager();
