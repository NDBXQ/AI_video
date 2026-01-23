import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { logger } from "@/shared/logger"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { ServiceError } from "@/server/services/errors"

import { GenerateVideoInput, GenerateVideoResult } from "./video-generation/types"
import { CozeVideoClient } from "./video-generation/cozeApiClient"
import { VideoDbService } from "./video-generation/videoDbService"
import { VideoJobManager } from "./video-generation/videoJobManager"

// Re-export types for backward compatibility
export type { GenerateVideoInput, GenerateVideoResult }

export class VideoGenerationService {
  /**
   * 生成视频
   * @param {string} userId - 用户ID
   * @param {GenerateVideoInput} input - 生成参数
   * @param {string} traceId - 链路ID
   * @returns {Promise<GenerateVideoResult>} 生成结果
   */
  static async generateVideo(userId: string, input: GenerateVideoInput, traceId: string): Promise<GenerateVideoResult> {
    const { storyboardId: inputStoryboardId, storyId: inputStoryId, prompt, mode, ratio, duration, watermark, first_image, last_image, forceRegenerate, async: asyncMode } = input
    const generateAudio = input.generate_audio ?? input.generateAudio ?? false
    const returnLastFrame = input.return_last_frame ?? true
    const resolvedMode = mode.trim()

    let resolvedStoryboardId: string | null = null
    let resolvedStoryId: string | null = null
    let existingVideoStorageKey: string | null = null
    let resolvedResolution: string | null = null
    let resolvedAspectRatio: string | null = null
    let resolvedVideoInfoBase: any | null = null

    if (inputStoryboardId) {
      const info = await VideoDbService.getStoryboardInfo(userId, inputStoryboardId)
      resolvedStoryboardId = info.storyboardId
      resolvedStoryId = info.storyId
      resolvedVideoInfoBase = info.videoInfoBase
      existingVideoStorageKey = info.existingVideoStorageKey
      resolvedResolution = info.resolution
      resolvedAspectRatio = info.aspectRatio
    } else if (inputStoryId) {
      const info = await VideoDbService.findMatchingStoryboard(userId, inputStoryId, first_image.url)
      resolvedStoryboardId = info?.storyboardId || null
      resolvedStoryId = info?.storyId || inputStoryId // Should be inputStoryId if not null
      resolvedVideoInfoBase = info?.videoInfoBase
      existingVideoStorageKey = info?.existingVideoStorageKey || null
      resolvedResolution = info?.resolution || null
      resolvedAspectRatio = info?.aspectRatio || null
    }

    const finalResolution = (input.resolution ?? resolvedResolution ?? "").trim() || "1080p"
    const finalRatio = (resolvedAspectRatio ?? "").trim() || ratio.trim() || "adaptive"

    if (asyncMode) {
      return VideoJobManager.enqueueJob(
        userId, 
        traceId, 
        input, 
        resolvedStoryId ?? inputStoryId ?? null, 
        resolvedStoryboardId,
        resolvedMode,
        finalResolution,
        finalRatio,
        existingVideoStorageKey
      )
    }

    const storage = createCozeS3Storage()

    if (!forceRegenerate && existingVideoStorageKey) {
      const signed = await storage.generatePresignedUrl({ key: existingVideoStorageKey, expireTime: 604800 })
      return {
        async: false,
        storyId: resolvedStoryId ?? inputStoryId ?? null,
        storyboardId: resolvedStoryboardId,
        video: { url: signed, mode: resolvedMode }
      }
    }

    logger.info({
      event: "video_creation_videos_generate_start",
      module: "video",
      traceId,
      message: "开始生成视频",
      storyId: resolvedStoryId ?? "",
      storyboardId: resolvedStoryboardId ?? "",
      mode: resolvedMode,
      duration,
      generateAudio,
      watermark
    })

    const start = Date.now()
    let cozeResult: { cozeData: unknown; videoUrl: string; lastFrameUrl?: string }

    try {
      cozeResult = await CozeVideoClient.generateVideo(
        input,
        traceId,
        resolvedMode,
        finalResolution,
        finalRatio
      )
    } catch (err) {
      const anyErr = err as { name?: string; message?: string; stack?: string }
      logger.error({
        event: "video_creation_videos_generate_error",
        module: "video",
        traceId,
        message: "生成视频异常",
        storyId: resolvedStoryId ?? "",
        storyboardId: resolvedStoryboardId ?? "",
        errorName: anyErr?.name,
        errorMessage: anyErr?.message,
        stack: anyErr?.stack
      })
      // Rethrow known errors or generic error
      if (err instanceof ServiceError) throw err
      throw new ServiceError("VIDEO_GENERATE_FAILED", "生成视频失败")
    }

    const { videoUrl: cozeVideoUrl, lastFrameUrl: cozeLastFrameUrl } = cozeResult
    
    if (!cozeVideoUrl) {
      throw new ServiceError("COZE_NO_VIDEO_URL", "生成结果缺少可用视频 URL")
    }

    const resp = await fetch(cozeVideoUrl)
    if (!resp.ok) {
      throw new ServiceError("VIDEO_DOWNLOAD_FAILED", `下载视频失败: ${resp.status}`)
    }
    const buf = Buffer.from(await resp.arrayBuffer())

    const timestamp = Date.now()
    const safeName = makeSafeObjectKeySegment(`video_${resolvedStoryboardId ?? inputStoryId ?? "story"}_${resolvedMode}`, 64)
    const fileKey = `generated_${resolvedStoryId ?? inputStoryId ?? "story"}_${resolvedStoryboardId ?? "unknown"}_${safeName}_${timestamp}.mp4`

    const uploadedKey = await storage.uploadFile({ fileContent: buf, fileName: fileKey, contentType: "video/mp4" })
    const signedUrl = await storage.generatePresignedUrl({ key: uploadedKey, expireTime: 604800 })

    if (resolvedStoryboardId) {
      await VideoDbService.updateStoryboardVideo(resolvedStoryboardId, resolvedVideoInfoBase, {
        url: signedUrl,
        storageKey: uploadedKey,
        duration,
        prompt: prompt.trim(),
        mode: resolvedMode,
        generateAudio,
        watermark,
        lastFrameUrl: cozeLastFrameUrl
      })
    }

    const durationMs = Date.now() - start
    logger.info({
      event: "video_creation_videos_generate_success",
      module: "video",
      traceId,
      message: "生成视频完成",
      durationMs,
      storyId: resolvedStoryId ?? "",
      storyboardId: resolvedStoryboardId ?? "",
      mode: resolvedMode
    })

    return {
      async: false,
      storyId: resolvedStoryId ?? inputStoryId ?? null,
      storyboardId: resolvedStoryboardId,
      video: { url: signedUrl, mode: resolvedMode },
      lastFrameImage: cozeLastFrameUrl ? { url: cozeLastFrameUrl } : null
    }
  }

  /**
   * 直接生成视频（不依赖内部数据库状态，直接调用 Coze）
   * @param {GenerateVideoInput} input - 生成参数
   * @param {string} traceId - 链路ID
   * @returns {Promise<Record<string, unknown>>} Coze返回结果
   */
  static async generateVideoDirect(input: GenerateVideoInput, traceId: string): Promise<Record<string, unknown>> {
    const { storyId, mode, ratio } = input
    const resolvedMode = mode.trim()

    let resolvedResolution = "1080p"
    let resolvedAspectRatio = "adaptive"
    
    if (storyId) {
      // Use helper but handle potential empty if story not found? Original code just tries to select.
      // If storyId is provided but not found, original code might just use default "1080p" if row is undefined.
      // Let's use DbService method but catch error or modify it to return null.
      // Actually VideoDbService.getStoryInfo currently assumes story exists or returns empty strings.
      // Let's modify usage slightly or just call it.
      try {
        const info = await VideoDbService.getStoryInfo(storyId)
        if (info.resolution) resolvedResolution = info.resolution
        if (info.aspectRatio) resolvedAspectRatio = info.aspectRatio
      } catch (e) {
        // If story not found, ignore and use defaults
      }
    }
    
    const finalResolution = (input.resolution ?? resolvedResolution ?? "").trim() || "1080p"
    const finalRatio = (resolvedAspectRatio ?? "").trim() || ratio.trim() || "adaptive"

    if (storyId) {
      await VideoDbService.updateStoryStatus(storyId, {
        status: "processing",
        progressStage: "video_assets",
        stageDetail: { stage: "video_assets", state: "processing" },
        traceId
      })
    }

    const start = Date.now()
    
    try {
        const { cozeData, videoUrl } = await CozeVideoClient.generateVideo(
            input,
            traceId,
            resolvedMode,
            finalResolution,
            finalRatio
        )

        const durationMs = Date.now() - start
        
        if (storyId) {
            await VideoDbService.updateStoryStatus(storyId, {
                stageDetail: { stage: "video_assets", state: "success", durationMs },
                traceId
            })
        }
        
        logger.info({
            event: "video_generate_direct_success",
            module: "video",
            traceId,
            message: "直接生成视频成功",
            durationMs,
            hasVideoUrl: Boolean(videoUrl)
        })

        return { ...((cozeData ?? {}) as Record<string, unknown>), extracted_video_url: videoUrl }

    } catch (err) {
      const durationMs = Date.now() - start
      
      let errorCode = "UNKNOWN"
      let errorMessage = "生成失败"

      // Handle specific error types if possible, otherwise generic
      const anyErr = err as { name?: string; message?: string; status?: number }
      
      if (anyErr.message === "Coze 调用失败，请稍后重试" || anyErr.name === "COZE_REQUEST_FAILED") {
          // It's likely a service error wrapping coze error or similar
           errorCode = "COZE_ERROR"
           errorMessage = "Coze 调用失败"
      } else {
           errorCode = anyErr?.name ?? "UNKNOWN"
           errorMessage = anyErr?.message ?? "生成异常"
      }

      if (storyId) {
        await VideoDbService.updateStoryStatus(storyId, {
          status: "failed",
          stageDetail: { 
            stage: "video_assets", 
            state: "failed", 
            durationMs, 
            errorCode, 
            errorMessage
          },
          traceId
        })
      }
      
      logger.error({
        event: "video_generate_direct_failed",
        module: "video",
        traceId,
        message: "直接生成视频失败",
        durationMs,
        errorName: errorCode,
        errorMessage: errorMessage
      })

      throw err
    }
  }
}
