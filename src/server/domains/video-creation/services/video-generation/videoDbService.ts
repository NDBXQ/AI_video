import { and, desc, eq, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { ServiceError } from "@/server/shared/errors"
import { mergeStoryboardVideoInfo } from "@/server/shared/storyboard/storyboardAssets"
import { updateStoryStatus } from "@/features/video/utils/storyStatus"

export interface StoryboardInfo {
  storyboardId: string
  storyId: string
  videoInfoBase: any
  existingVideoStorageKey: string | null
  resolution: string | null
  aspectRatio: string | null
}

export class VideoDbService {
  static async getStoryboardInfo(userId: string, storyboardId: string): Promise<StoryboardInfo> {
    const db = await getDb({ stories, storyOutlines, storyboards })
    const rows = await db
      .select({
        storyId: stories.id,
        resolution: stories.resolution,
        aspectRatio: stories.aspectRatio,
        videoInfo: storyboards.videoInfo
      })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
      .limit(1)

    if (rows.length === 0) {
      throw new ServiceError("STORYBOARD_NOT_FOUND", "未找到可用的分镜")
    }

    return {
      storyboardId,
      storyId: rows[0].storyId,
      videoInfoBase: rows[0].videoInfo ?? null,
      existingVideoStorageKey: (rows[0].videoInfo as any)?.storageKey ?? null,
      resolution: (rows[0] as any)?.resolution ?? null,
      aspectRatio: (rows[0] as any)?.aspectRatio ?? null
    }
  }

  static async findMatchingStoryboard(userId: string, storyId: string, firstImageUrl: string): Promise<StoryboardInfo | null> {
    const db = await getDb({ stories, storyOutlines, storyboards })
    
    // First get story info
    const allowed = await db
        .select({ id: stories.id, resolution: stories.resolution, aspectRatio: stories.aspectRatio })
        .from(stories)
        .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
        .limit(1)
      
    if (allowed.length === 0) {
        throw new ServiceError("STORY_NOT_FOUND", "未找到可用的故事")
    }

    const resolution = allowed[0]?.resolution ?? null
    const aspectRatio = allowed[0]?.aspectRatio ?? null

    // Try to find matching storyboard
    const matched = await db
      .select({
        id: storyboards.id,
        videoInfo: storyboards.videoInfo
      })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .where(and(eq(storyOutlines.storyId, storyId), sql`${storyboards.frames} -> 'first' ->> 'url' = ${firstImageUrl}`))
      .orderBy(desc(storyboards.updatedAt), desc(storyboards.createdAt))
      .limit(1)

    if (matched.length > 0) {
      return {
        storyboardId: matched[0].id,
        storyId,
        videoInfoBase: matched[0].videoInfo ?? null,
        existingVideoStorageKey: (matched[0].videoInfo as any)?.storageKey ?? null,
        resolution,
        aspectRatio
      }
    }

    // Return partial info if storyboard not found but story exists
    return {
        storyboardId: "", // Not found
        storyId,
        videoInfoBase: null,
        existingVideoStorageKey: null,
        resolution,
        aspectRatio
    }
  }

  static async getStoryInfo(storyId: string): Promise<{ resolution: string; aspectRatio: string }> {
      const db = await getDb({ stories })
      const [row] = await db.select({ resolution: stories.resolution, aspectRatio: stories.aspectRatio }).from(stories).where(eq(stories.id, storyId)).limit(1)
      return {
          resolution: (row?.resolution ?? "").trim(),
          aspectRatio: (row?.aspectRatio ?? "").trim()
      }
  }

  static async updateStoryboardVideo(
    storyboardId: string, 
    videoInfoBase: any, 
    updateData: {
      url: string,
      storageKey: string,
      duration: number,
      prompt: string,
      mode: string,
      generateAudio: boolean,
      watermark: boolean,
      lastFrameUrl?: string
    }
  ) {
    const db = await getDb({ storyboards })
    const nextVideoInfo = mergeStoryboardVideoInfo(videoInfoBase, {
        url: updateData.url,
        storageKey: updateData.storageKey,
        durationSeconds: updateData.duration,
        prompt: updateData.prompt,
        settings: { 
            mode: updateData.mode, 
            generateAudio: updateData.generateAudio, 
            watermark: updateData.watermark, 
            ...(updateData.lastFrameUrl ? { lastFrameUrl: updateData.lastFrameUrl } : {}) 
        }
      })

      await db
        .update(storyboards)
        .set({
          isVideoGenerated: true,
          videoInfo: nextVideoInfo as any,
          updatedAt: new Date()
        })
        .where(eq(storyboards.id, storyboardId))
  }

  static async updateStoryStatus(storyId: string, status: any) {
      return updateStoryStatus(storyId, status)
  }
}
