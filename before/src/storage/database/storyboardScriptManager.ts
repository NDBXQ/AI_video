import { eq, and, desc } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { storyboardScripts, insertStoryboardScriptSchema, updateStoryboardScriptSchema } from "./shared/schema";
import type { StoryboardScript, InsertStoryboardScript, UpdateStoryboardScript } from "./shared/schema";

export class StoryboardScriptManager {
  /**
   * 创建分镜脚本
   */
  async createStoryboardScript(data: InsertStoryboardScript): Promise<StoryboardScript> {
    const db = await getDb();
    const validated = insertStoryboardScriptSchema.parse(data);
    const [script] = await db.insert(storyboardScripts).values(validated).returning();
    return script;
  }

  /**
   * 批量创建分镜脚本
   */
  async createStoryboardScripts(data: InsertStoryboardScript[]): Promise<StoryboardScript[]> {
    const db = await getDb();
    const validated = data.map((item) => insertStoryboardScriptSchema.parse(item));
    const scripts = await db.insert(storyboardScripts).values(validated).returning();
    return scripts;
  }

  /**
   * 根据 storyboardTextId 获取所有分镜脚本
   */
  async getStoryboardScriptsByTextId(textId: string): Promise<StoryboardScript[]> {
    const db = await getDb();
    return db
      .select()
      .from(storyboardScripts)
      .where(eq(storyboardScripts.storyboardTextId, textId))
      .orderBy(storyboardScripts.sequence);
  }

  /**
   * 根据 ID 获取分镜脚本
   */
  async getStoryboardScriptById(id: string): Promise<StoryboardScript | null> {
    const db = await getDb();
    const [script] = await db.select().from(storyboardScripts).where(eq(storyboardScripts.id, id));
    return script || null;
  }

  /**
   * 根据序号获取指定分镜文本的脚本
   */
  async getStoryboardScriptBySequence(textId: string, sequence: number): Promise<StoryboardScript | null> {
    const db = await getDb();
    const [script] = await db
      .select()
      .from(storyboardScripts)
      .where(
        and(
          eq(storyboardScripts.storyboardTextId, textId),
          eq(storyboardScripts.sequence, sequence)
        )
      );
    return script || null;
  }

  /**
   * 更新分镜脚本
   */
  async updateStoryboardScript(id: string, data: UpdateStoryboardScript): Promise<StoryboardScript | null> {
    const db = await getDb();
    const validated = updateStoryboardScriptSchema.parse(data);
    const [script] = await db
      .update(storyboardScripts)
      .set({ ...validated, updatedAt: new Date().toISOString() })
      .where(eq(storyboardScripts.id, id))
      .returning();
    return script || null;
  }

  /**
   * 删除分镜文本的所有脚本
   */
  async deleteStoryboardScriptsByTextId(textId: string): Promise<number> {
    const db = await getDb();
    const result = await db.delete(storyboardScripts).where(eq(storyboardScripts.storyboardTextId, textId));
    return result.rowCount ?? 0;
  }

  /**
   * 删除单个分镜脚本
   */
  async deleteStoryboardScript(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(storyboardScripts).where(eq(storyboardScripts.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storyboardScriptManager = new StoryboardScriptManager();
