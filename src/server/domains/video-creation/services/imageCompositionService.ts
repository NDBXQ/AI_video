import "server-only"

import { and, desc, eq, isNull, or } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/shared/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { extractCozeImageUrl } from "@/features/coze/imageClient"
import { extractReferenceImagePrompts } from "@/features/video/utils/referenceImagePrompts"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { logger } from "@/shared/logger"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { mergeStoryboardFrames } from "@/server/shared/storyboard/storyboardAssets"
import { resolveStorageUrl } from "@/shared/storageUrl"

import { ServiceError } from "@/server/shared/errors"

export interface ComposeImageResult {
  storyId: string
  storyboardId: string
  image: { name: string; url: string; thumbnailUrl: string }
  lastImage?: { name: string; url: string; thumbnailUrl: string }
}

export class ImageCompositionService {
  static async composeImage(
    userId: string,
    storyboardId: string,
    traceId: string,
    referenceImages?: Array<{ name: string; url: string }>
  ): Promise<ComposeImageResult> {
    const result = await ImageCompositionService.composeInternal({ userId, storyboardId, traceId, mode: "both", referenceImages })
    if (!result.image) throw new ServiceError("COMPOSE_FAILED", "图片合成失败")
    return { storyId: result.storyId, storyboardId: result.storyboardId, image: result.image, ...(result.lastImage ? { lastImage: result.lastImage } : {}) }
  }

  static async composeTailImage(
    userId: string,
    storyboardId: string,
    traceId: string,
    referenceImages?: Array<{ name: string; url: string }>
  ): Promise<{ storyId: string; storyboardId: string; lastImage: { name: string; url: string; thumbnailUrl: string } }> {
    const result = await ImageCompositionService.composeInternal({ userId, storyboardId, traceId, mode: "tailOnly", referenceImages })
    if (!result.lastImage) throw new ServiceError("COMPOSE_FAILED", "尾帧图片合成失败")
    return { storyId: result.storyId, storyboardId: result.storyboardId, lastImage: result.lastImage }
  }

  private static async composeInternal(params: {
    userId: string
    storyboardId: string
    traceId: string
    mode: "both" | "tailOnly"
    referenceImages?: Array<{ name: string; url: string }>
  }): Promise<{ storyId: string; storyboardId: string; image?: { name: string; url: string; thumbnailUrl: string }; lastImage?: { name: string; url: string; thumbnailUrl: string } }> {
    const { userId, storyboardId, traceId, mode, referenceImages } = params
    const start = Date.now()
    const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

    const allowed = await db
      .select({
        storyId: stories.id,
        storyStyle: stories.shotStyle,
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
    const storyStyle = typeof allowed[0].storyStyle === "string" ? allowed[0].storyStyle.trim() : ""
    const aspectRatio = allowed[0].aspectRatio || "16:9"
    const prompt = (allowed[0].storyboardFrames?.first?.prompt ?? "").trim()
    const lastPrompt = (allowed[0].storyboardFrames?.last?.prompt ?? "").trim()
    const scriptContent = allowed[0].storyboardScriptContent

    if (mode === "both" && !prompt) throw new ServiceError("PROMPT_NOT_FOUND", "该分镜缺少首帧提示词")
    if (mode === "tailOnly" && !lastPrompt) throw new ServiceError("PROMPT_NOT_FOUND", "该分镜缺少尾帧提示词")

    const url = readEnv("IMAGE_COMPOSE_API_URL")
    const token = readEnv("IMAGE_COMPOSE_API_TOKEN")
    if (!url || !token) {
      throw new ServiceError("COZE_NOT_CONFIGURED", "Coze 未配置，请设置 IMAGE_COMPOSE_API_URL 与 IMAGE_COMPOSE_API_TOKEN")
    }

    logger.info({
      event: mode === "tailOnly" ? "video_creation_images_compose_tail_start" : "video_creation_images_compose_start",
      module: "video",
      traceId,
      message: mode === "tailOnly" ? "开始合成尾帧图片" : "开始合成图片",
      storyId: effectiveStoryId,
      storyboardId
    })

    const requiredPrompts = extractReferenceImagePrompts(scriptContent)
    const baseName = `合成图片_${storyboardId}`
    const tailName = `${baseName}_tail`
    const excludedNames = new Set<string>([baseName, tailName])

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
    const latestByName = new Map<string, { name: string; category: string; url: string }>()
    for (const row of candidates) {
      if (!row.url) continue
      if (excludedNames.has(row.name)) continue
      const key = `${row.category}::${row.name}`
      if (!latestByKey.has(key)) latestByKey.set(key, { name: row.name, category: row.category, url: row.url })
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

    const promptList = mode === "tailOnly" ? [lastPrompt] : (lastPrompt ? [prompt, lastPrompt] : [prompt])

    let cozeData: unknown
    try {
      const coze = await callCozeRunEndpoint({
        traceId,
        url,
        token,
        body: { image_list: imageList, prompt: promptList, aspect_ratio: aspectRatio, ...(storyStyle ? { style: storyStyle } : {}) },
        module: "video"
      })
      cozeData = coze.data
    } catch (err) {
      if (err instanceof CozeRunEndpointError) {
        throw new ServiceError("COZE_REQUEST_FAILED", "Coze 调用失败，请稍后重试")
      }
      const anyErr = err as { name?: string; message?: string; stack?: string }
      logger.error({
        event: mode === "tailOnly" ? "video_creation_images_compose_tail_error" : "video_creation_images_compose_error",
        module: "video",
        traceId,
        message: mode === "tailOnly" ? "尾帧图片合成异常" : "图片合成异常",
        errorName: anyErr?.name,
        errorMessage: anyErr?.message,
        stack: anyErr?.stack
      })
      throw new ServiceError("COMPOSE_FAILED", "图片合成失败")
    }

    const urls = ImageCompositionService.extractComposedImageUrls(cozeData)
    const cozeFirstUrl = urls[0] ?? null
    const cozeSecondUrl = urls[1] ?? null

    if (!cozeFirstUrl) throw new ServiceError("COZE_NO_IMAGE_URL", mode === "tailOnly" ? "尾帧合成结果缺少可用图片 URL" : "合成结果缺少可用图片 URL")
    if (mode === "both" && lastPrompt && !cozeSecondUrl) throw new ServiceError("COZE_NO_IMAGE_URL", "尾帧合成结果缺少可用图片 URL")

    const storage = createCozeS3Storage()
    const timestamp = Date.now()

    const uploadOne = async (name: string, imageUrl: string, keySuffix: string) => {
      const imageBuffer = await downloadImage(imageUrl, traceId)
      const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)
      const safeName = makeSafeObjectKeySegment(name, 64)
      const originalKey = `composed_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_${keySuffix}_original.jpg`
      const thumbnailKey = `composed_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_${keySuffix}_thumbnail.jpg`
      const uploadedOriginalKey = await storage.uploadFile({ fileContent: imageBuffer, fileName: originalKey, contentType: "image/jpeg" })
      const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBuffer, fileName: thumbnailKey, contentType: "image/jpeg" })
      const originalSignedUrl = await resolveStorageUrl(storage, uploadedOriginalKey)
      const thumbnailSignedUrl = await resolveStorageUrl(storage, uploadedThumbnailKey)
      return { name, url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl }
    }

    const image = mode === "tailOnly" ? undefined : await uploadOne(baseName, cozeFirstUrl, "first")
    const lastImage =
      mode === "tailOnly"
        ? await uploadOne(tailName, cozeFirstUrl, "last")
        : lastPrompt && cozeSecondUrl
          ? await uploadOne(tailName, cozeSecondUrl, "last")
          : undefined

    const nextFrames =
      mode === "tailOnly"
        ? mergeStoryboardFrames(allowed[0].storyboardFrames as any, { last: { url: lastImage!.url, thumbnailUrl: lastImage!.thumbnailUrl } } as any)
        : mergeStoryboardFrames(allowed[0].storyboardFrames as any, {
            ...(image ? { first: { url: image.url, thumbnailUrl: image.thumbnailUrl } } : {}),
            ...(lastImage ? { last: { url: lastImage.url, thumbnailUrl: lastImage.thumbnailUrl } } : {})
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
      event: mode === "tailOnly" ? "video_creation_images_compose_tail_success" : "video_creation_images_compose_success",
      module: "video",
      traceId,
      message: mode === "tailOnly" ? "尾帧图片合成完成" : "合成图片完成",
      durationMs,
      storyId: effectiveStoryId,
      storyboardId
    })

    return { storyId: effectiveStoryId, storyboardId, ...(image ? { image } : {}), ...(lastImage ? { lastImage } : {}) }
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
