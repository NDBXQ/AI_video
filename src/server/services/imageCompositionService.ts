import { and, desc, eq, isNull, or } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { extractCozeImageUrl } from "@/features/coze/imageClient"
import { extractReferenceImagePrompts } from "@/features/video/utils/referenceImagePrompts"
import { downloadImage, generateThumbnail } from "@/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { logger } from "@/shared/logger"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { mergeStoryboardFrames } from "@/server/services/storyboardAssets"

import { ServiceError } from "@/server/services/errors"

export interface ComposeImageResult {
  storyId: string
  storyboardId: string
  image: { name: string; url: string; thumbnailUrl: string }
  lastImage?: { name: string; url: string; thumbnailUrl: string }
}

export class ImageCompositionService {
  /**
   * 合成图片
   * @param {string} userId - 用户ID
   * @param {string} storyboardId - 分镜ID
   * @param {string} traceId - 链路ID
   * @returns {Promise<ComposeImageResult>} 合成结果
   */
  static async composeImage(
    userId: string,
    storyboardId: string,
    traceId: string,
    referenceImages?: Array<{ name: string; url: string }>
  ): Promise<ComposeImageResult> {
    const start = Date.now()
    const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

    const allowed = await db
      .select({
        storyId: stories.id,
        aspectRatio: stories.aspectRatio,
        storyboardFrames: storyboards.frames,
        storyboardScriptContent: storyboards.scriptContent
      })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
      .limit(1)

    if (allowed.length === 0) {
      throw new ServiceError("STORYBOARD_NOT_FOUND", "未找到可用的分镜")
    }

    const effectiveStoryId = allowed[0].storyId
    const aspectRatio = allowed[0].aspectRatio || "16:9"
    const prompt = (allowed[0].storyboardFrames?.first?.prompt ?? "").trim()
    const lastPrompt = (allowed[0].storyboardFrames?.last?.prompt ?? "").trim()
    const scriptContent = allowed[0].storyboardScriptContent

    if (!prompt) {
      throw new ServiceError("PROMPT_NOT_FOUND", "该分镜缺少首帧提示词")
    }

    const url = readEnv("COZE_IMAGE_COMPOSE_API_URL")
    const token = readEnv("COZE_IMAGE_COMPOSE_API_TOKEN")
    if (!url || !token) {
      throw new ServiceError(
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_IMAGE_COMPOSE_API_URL 与 COZE_IMAGE_COMPOSE_API_TOKEN"
      )
    }

    logger.info({
      event: "video_creation_images_compose_start",
      module: "video",
      traceId,
      message: "开始合成图片",
      storyId: effectiveStoryId,
      storyboardId
    })

    const requiredPrompts = extractReferenceImagePrompts(scriptContent)

    const composedName = `合成图片_${storyboardId}`
    const candidates =
      referenceImages && referenceImages.length > 0
        ? referenceImages
            .map((p) => ({ name: p.name, category: "reference", url: p.url, createdAt: new Date() }))
            .filter((p) => typeof p.url === "string" && (p.url.startsWith("http") || p.url.startsWith("data:")))
        : await db
            .select({
              id: generatedImages.id,
              name: generatedImages.name,
              category: generatedImages.category,
              url: generatedImages.url,
              createdAt: generatedImages.createdAt
            })
            .from(generatedImages)
            .where(and(eq(generatedImages.storyId, effectiveStoryId), or(eq(generatedImages.storyboardId, storyboardId), isNull(generatedImages.storyboardId))))
            .orderBy(desc(generatedImages.createdAt))
            .limit(500)

    const latestByKey = new Map<string, { name: string; category: string; url: string }>()
    for (const row of candidates) {
      if (!row.url) continue
      if (row.name === composedName) continue
      const key = `${row.category}::${row.name}`
      if (!latestByKey.has(key)) latestByKey.set(key, { name: row.name, category: row.category, url: row.url })
    }

    const latestByName = new Map<string, { name: string; category: string; url: string }>()
    for (const row of candidates) {
      if (!row.url) continue
      if (row.name === composedName) continue
      if (!latestByName.has(row.name)) latestByName.set(row.name, { name: row.name, category: row.category, url: row.url })
    }

    const imageList: Array<{ image_name: string; image_url: string }> = []
    if (requiredPrompts.length > 0) {
      for (const p of requiredPrompts) {
        const exact = latestByKey.get(`${p.category}::${p.name}`)
        const loose = latestByName.get(p.name)
        const picked = exact ?? loose
        if (picked) imageList.push({ image_name: picked.name, image_url: picked.url })
        if (imageList.length >= 50) break
      }
    } else {
      for (const v of latestByName.values()) {
        imageList.push({ image_name: v.name, image_url: v.url })
        if (imageList.length >= 50) break
      }
    }

    if (imageList.length === 0) {
      throw new ServiceError("NO_REFERENCE_IMAGES", "该分镜缺少可用于合成的参考图")
    }

    let cozeData: unknown
    try {
      const prompts = lastPrompt ? [prompt, lastPrompt] : [prompt]
      const coze = await callCozeRunEndpoint({
        traceId,
        url,
        token,
        body: { image_list: imageList, prompt: prompts, aspect_ratio: aspectRatio },
        module: "video"
      })
      cozeData = coze.data
    } catch (err) {
      if (err instanceof CozeRunEndpointError) {
        throw new ServiceError("COZE_REQUEST_FAILED", "Coze 调用失败，请稍后重试")
      }
      const anyErr = err as { name?: string; message?: string; stack?: string }
      logger.error({
        event: "video_creation_images_compose_error",
        module: "video",
        traceId,
        message: "图片合成异常",
        errorName: anyErr?.name,
        errorMessage: anyErr?.message,
        stack: anyErr?.stack
      })
      throw new ServiceError("COMPOSE_FAILED", "图片合成失败")
    }

    const urls = ImageCompositionService.extractComposedImageUrls(cozeData)
    const cozeImageUrl = urls[0] ?? null
    const cozeLastImageUrl = lastPrompt ? (urls[1] ?? null) : null
    if (!cozeImageUrl) throw new ServiceError("COZE_NO_IMAGE_URL", "合成结果缺少可用图片 URL")
    if (lastPrompt && !cozeLastImageUrl) throw new ServiceError("COZE_NO_IMAGE_URL", "尾帧合成结果缺少可用图片 URL")

    const imageBuffer = await downloadImage(cozeImageUrl, traceId)
    const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)
    const lastImageBuffer = cozeLastImageUrl ? await downloadImage(cozeLastImageUrl, traceId) : null
    const lastThumbnailBuffer = lastImageBuffer ? await generateThumbnail(lastImageBuffer, 300, traceId) : null

    const storage = createCozeS3Storage()
    const timestamp = Date.now()
    const safeName = makeSafeObjectKeySegment(composedName, 64)
    const originalKey = `composed_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_original.jpg`
    const thumbnailKey = `composed_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_thumbnail.jpg`
    const lastSafeName = makeSafeObjectKeySegment(`${composedName}_tail`, 64)
    const lastOriginalKey = `composed_${effectiveStoryId}_${storyboardId}_${lastSafeName}_${timestamp}_last_original.jpg`
    const lastThumbnailKey = `composed_${effectiveStoryId}_${storyboardId}_${lastSafeName}_${timestamp}_last_thumbnail.jpg`

    const uploadedOriginalKey = await storage.uploadFile({ fileContent: imageBuffer, fileName: originalKey, contentType: "image/jpeg" })
    const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBuffer, fileName: thumbnailKey, contentType: "image/jpeg" })
    const uploadedLastOriginalKey = lastImageBuffer ? await storage.uploadFile({ fileContent: lastImageBuffer, fileName: lastOriginalKey, contentType: "image/jpeg" }) : null
    const uploadedLastThumbnailKey = lastThumbnailBuffer ? await storage.uploadFile({ fileContent: lastThumbnailBuffer, fileName: lastThumbnailKey, contentType: "image/jpeg" }) : null

    const originalSignedUrl = await storage.generatePresignedUrl({ key: uploadedOriginalKey, expireTime: 604800 })
    const thumbnailSignedUrl = await storage.generatePresignedUrl({ key: uploadedThumbnailKey, expireTime: 604800 })
    const lastOriginalSignedUrl = uploadedLastOriginalKey ? await storage.generatePresignedUrl({ key: uploadedLastOriginalKey, expireTime: 604800 }) : null
    const lastThumbnailSignedUrl = uploadedLastThumbnailKey ? await storage.generatePresignedUrl({ key: uploadedLastThumbnailKey, expireTime: 604800 }) : null

    const nextFrames = mergeStoryboardFrames(allowed[0].storyboardFrames as any, {
      first: { url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl },
      ...(lastOriginalSignedUrl && lastThumbnailSignedUrl ? { last: { url: lastOriginalSignedUrl, thumbnailUrl: lastThumbnailSignedUrl } } : {})
    })

    await db
      .update(storyboards)
      .set({
        frames: nextFrames as any,
        isReferenceGenerated: true,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, storyboardId))

    const durationMs = Date.now() - start
    logger.info({
      event: "video_creation_images_compose_success",
      module: "video",
      traceId,
      message: "合成图片完成",
      durationMs,
      storyId: effectiveStoryId,
      storyboardId
    })

    return {
      storyId: effectiveStoryId,
      storyboardId,
      image: {
        name: composedName,
        url: originalSignedUrl,
        thumbnailUrl: thumbnailSignedUrl
      },
      ...(lastOriginalSignedUrl && lastThumbnailSignedUrl
        ? { lastImage: { name: `${composedName}_tail`, url: lastOriginalSignedUrl, thumbnailUrl: lastThumbnailSignedUrl } }
        : {})
    }
  }

  private static extractComposedImageUrl(data: unknown): string | null {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const anyData = data as Record<string, unknown>
      const list = anyData["generated_image_urls"]
      if (Array.isArray(list)) {
        const first = list.find((v) => typeof v === "string" && (v.startsWith("http") || v.startsWith("data:")))
        if (typeof first === "string" && first) return first
      }
      const direct = anyData["generated_image_url"]
      if (typeof direct === "string" && (direct.startsWith("http") || direct.startsWith("data:"))) return direct
      const nested = anyData["data"]
      if (nested) {
        const nestedUrl = ImageCompositionService.extractComposedImageUrl(nested)
        if (nestedUrl) return nestedUrl
      }
    }
    try {
      return extractCozeImageUrl(data as any)
    } catch {
      return null
    }
  }

  private static extractComposedImageUrls(data: unknown): string[] {
    const out: string[] = []
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const anyData = data as Record<string, unknown>
      const list = anyData["generated_image_urls"]
      if (Array.isArray(list)) {
        for (const v of list) {
          if (typeof v === "string" && (v.startsWith("http") || v.startsWith("data:"))) out.push(v)
        }
        if (out.length > 0) return out
      }
    }
    const single = ImageCompositionService.extractComposedImageUrl(data)
    return single ? [single] : []
  }
}
