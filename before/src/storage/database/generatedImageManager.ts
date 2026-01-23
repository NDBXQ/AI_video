import { eq, and, inArray, like, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { generatedImages, insertGeneratedImageSchema, updateGeneratedImageSchema } from "./shared/schema";
import type { GeneratedImage, InsertGeneratedImage, UpdateGeneratedImage } from "./shared/schema";

export class GeneratedImageManager {
  /**
   * 创建生成的图片
   */
  async createGeneratedImage(data: InsertGeneratedImage): Promise<GeneratedImage> {
    const db = await getDb();
    const validated = insertGeneratedImageSchema.parse(data);
    const [image] = await db.insert(generatedImages).values(validated).returning();
    return image;
  }

  /**
   * 批量创建生成的图片
   */
  async createGeneratedImages(data: InsertGeneratedImage[]): Promise<GeneratedImage[]> {
    const db = await getDb();
    const validated = data.map((item) => insertGeneratedImageSchema.parse(item));
    const images = await db.insert(generatedImages).values(validated).returning();
    return images;
  }

  /**
   * 根据 storyId 获取所有生成的图片
   */
  async getGeneratedImagesByStoryId(storyId: string): Promise<GeneratedImage[]> {
    const db = await getDb();
    return db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.storyId, storyId))
      .orderBy(generatedImages.createdAt);
  }

  /**
   * 根据 ID 获取生成的图片
   */
  async getGeneratedImageById(id: string): Promise<GeneratedImage | null> {
    const db = await getDb();
    const [image] = await db.select().from(generatedImages).where(eq(generatedImages.id, id));
    return image || null;
  }

  /**
   * 根据 storyId、storyboardId 和 name 获取图片
   */
  async getGeneratedImageByName(
    storyId: string,
    name: string,
    category?: 'background' | 'role' | 'item'
  ): Promise<GeneratedImage | null> {
    const db = await getDb();
    const [image] = await db
      .select()
      .from(generatedImages)
      .where(
        and(
          eq(generatedImages.storyId, storyId),
          eq(generatedImages.name, name),
          ...(category ? [eq(generatedImages.category, category)] : [])
        )
      );
    return image || null;
  }

  /**
   * 获取故事下的合成图片
   */
  async getComposedImagesByStoryId(storyId: string): Promise<GeneratedImage[]> {
    const db = await getDb();
    return db
      .select()
      .from(generatedImages)
      .where(and(eq(generatedImages.storyId, storyId), like(generatedImages.name, '合成图片_%')))
      .orderBy(generatedImages.createdAt);
  }

  /**
   * 根据 storyId 和 name 获取图片（在整个故事中查找同名图片）
   */
  async getGeneratedImageByStoryIdAndName(storyId: string, name: string): Promise<GeneratedImage | null> {
    const db = await getDb();
    const [image] = await db
      .select()
      .from(generatedImages)
      .where(
        and(
          eq(generatedImages.storyId, storyId),
          eq(generatedImages.name, name)
        )
      );
    return image || null;
  }

  async getGeneratedImagesByStoryIdAndNameAll(
    storyId: string,
    name: string,
    category?: 'background' | 'role' | 'item'
  ): Promise<GeneratedImage[]> {
    const db = await getDb();
    return db
      .select()
      .from(generatedImages)
      .where(
        and(
          eq(generatedImages.storyId, storyId),
          eq(generatedImages.name, name),
          ...(category ? [eq(generatedImages.category, category)] : [])
        )
      )
      .orderBy(desc(generatedImages.createdAt));
  }

  /**
   * 根据 storyId 和名字列表获取图片（支持角色/背景/物品名过滤）
   * @param storyId 故事ID
   * @param names 名字列表（角色名、背景名、物品名）
   * @param excludeComposed 是否排除合成图片（默认true）
   */
  async getGeneratedImagesByStoryIdAndNames(
    storyId: string,
    names: string[],
    excludeComposed: boolean = true
  ): Promise<GeneratedImage[]> {
    const db = await getDb();

    if (process.env.DEBUG_IMAGE_QUERY === '1') {
      const normalizedNames = Array.isArray(names)
        ? names.map((n) => (typeof n === 'string' ? n.trim() : String(n))).filter((n) => n.length > 0)
        : [];
      console.log('[generatedImageManager.getGeneratedImagesByStoryIdAndNames]', {
        storyId,
        excludeComposed,
        namesCount: normalizedNames.length,
        namesPreview: normalizedNames.slice(0, 50),
      });
    }

    const conditions = [eq(generatedImages.storyId, storyId)];

    // 如果有名字列表，添加名字过滤条件
    if (names.length > 0) {
      conditions.push(inArray(generatedImages.name, names));
    }

    // 如果排除合成图片，添加过滤条件
    if (excludeComposed) {
      conditions.push(sql`${generatedImages.name} NOT LIKE ${'合成图片_%'}`);
    }

    return db
      .select()
      .from(generatedImages)
      .where(and(...conditions))
      .orderBy(generatedImages.createdAt);
  }

  /**
   * 更新生成的图片
   */
  async updateGeneratedImage(id: string, data: UpdateGeneratedImage): Promise<GeneratedImage | null> {
    const db = await getDb();
    const validated = updateGeneratedImageSchema.parse(data);
    const [image] = await db
      .update(generatedImages)
      .set(validated)
      .where(eq(generatedImages.id, id))
      .returning();
    return image || null;
  }

  /**
   * 删除 story 的所有图片
   */
  async deleteGeneratedImagesByStoryId(storyId: string): Promise<number> {
    const db = await getDb();
    const result = await db.delete(generatedImages).where(eq(generatedImages.storyId, storyId));
    return result.rowCount ?? 0;
  }

  /**
   * 删除单个图片
   */
  async deleteGeneratedImage(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(generatedImages).where(eq(generatedImages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteGeneratedImagesByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await getDb();
    const result = await db.delete(generatedImages).where(inArray(generatedImages.id, ids));
    return result.rowCount ?? 0;
  }
}

// 导出单例
export const generatedImageManager = new GeneratedImageManager();
