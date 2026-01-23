import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import { generatedVideos, insertGeneratedVideoSchema, updateGeneratedVideoSchema } from "./shared/schema";
import type { GeneratedVideo, InsertGeneratedVideo, UpdateGeneratedVideo } from "./shared/schema";

export class GeneratedVideoManager {
  /**
   * 创建生成的视频
   */
  async createGeneratedVideo(data: InsertGeneratedVideo): Promise<GeneratedVideo> {
    const db = await getDb();

    // 只传递必需字段，让数据库使用默认值
    const [video] = await db.insert(generatedVideos).values({
      storyId: data.storyId,
      storyboardId: data.storyboardId,
      name: data.name,
      description: data.description || '',
      url: data.url,
      storageKey: data.storageKey,
      mode: data.mode,
    }).returning();

    return video;
  }

  /**
   * 根据 storyId 获取所有生成的视频
   */
  async getGeneratedVideosByStoryId(storyId: string): Promise<GeneratedVideo[]> {
    const db = await getDb();
    return db
      .select()
      .from(generatedVideos)
      .where(eq(generatedVideos.storyId, storyId))
      .orderBy(generatedVideos.createdAt);
  }

  /**
   * 根据 storyboardId 获取所有生成的视频
   */
  async getGeneratedVideosByStoryboardId(storyboardId: string): Promise<GeneratedVideo[]> {
    const db = await getDb();
    return db
      .select()
      .from(generatedVideos)
      .where(eq(generatedVideos.storyboardId, storyboardId))
      .orderBy(generatedVideos.createdAt);
  }

  /**
   * 根据 ID 获取生成的视频
   */
  async getGeneratedVideoById(id: string): Promise<GeneratedVideo | null> {
    const db = await getDb();
    const [video] = await db.select().from(generatedVideos).where(eq(generatedVideos.id, id));
    return video || null;
  }

  /**
   * 更新生成的视频
   */
  async updateGeneratedVideo(id: string, data: UpdateGeneratedVideo): Promise<GeneratedVideo | null> {
    const db = await getDb();
    const validated = updateGeneratedVideoSchema.parse(data);
    const [video] = await db
      .update(generatedVideos)
      .set(validated)
      .where(eq(generatedVideos.id, id))
      .returning();
    return video || null;
  }

  /**
   * 删除生成的视频
   */
  async deleteGeneratedVideo(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.delete(generatedVideos).where(eq(generatedVideos.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

// 导出单例
export const generatedVideoManager = new GeneratedVideoManager();
