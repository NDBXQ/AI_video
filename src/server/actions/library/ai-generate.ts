"use server"

import { cookies } from "next/headers"
import { getDb } from "coze-coding-dev-sdk"
import { insertPublicResourceSchema, publicResources } from "@/shared/schema/library"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { generateImageByCoze } from "@/features/coze/imageClient"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { uploadPublicBuffer } from "@/shared/storage"

export async function aiGeneratePublicResource(input: {
  type: "background" | "character" | "props"
  prompt: string
  name?: string
  description?: string
  tags?: string
  applicableScenes?: string
}): Promise<{ success: boolean; message?: string }> {
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return { success: false, message: "未登录或登录已过期" }
    const session = await verifySessionToken(token, traceId)
    if (!session) return { success: false, message: "未登录或登录已过期" }

    const prompt = input.prompt.trim()
    if (!prompt) return { success: false, message: "提示词不能为空" }

    const imageType = input.type === "background" ? "background" : input.type === "character" ? "role" : "item"

    logger.info({
      event: "library_public_resource_ai_generate_start",
      module: "library",
      traceId,
      message: "开始 AI 生成公共资源",
      type: input.type,
      promptChars: prompt.length
    })

    const apiImageUrl = await generateImageByCoze(prompt, imageType, { traceId, module: "coze" })
    const imageBuffer = await downloadImage(apiImageUrl, traceId)
    const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)

    const originalUpload = await uploadPublicBuffer({
      buffer: imageBuffer,
      contentType: "image/jpeg",
      fileExt: "jpg",
      prefix: `public-resources/${input.type}/original`
    })
    const thumbUpload = await uploadPublicBuffer({
      buffer: thumbnailBuffer,
      contentType: "image/jpeg",
      fileExt: "jpg",
      prefix: `public-resources/${input.type}/thumbnail`
    })

    const tags = (input.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const applicableScenes = (input.applicableScenes ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    const resourceName = input.name?.trim() || `AI-${input.type}-${new Date().toISOString().slice(0, 10)}`

    const payload = insertPublicResourceSchema.parse({
      userId: session.userId,
      type: input.type,
      source: "ai",
      name: resourceName,
      description: input.description?.trim() ?? "",
      previewUrl: thumbUpload.url,
      previewStorageKey: thumbUpload.key,
      originalUrl: originalUpload.url,
      originalStorageKey: originalUpload.key,
      tags,
      applicableScenes
    })

    const db = await getDb({ publicResources })
    await db.insert(publicResources).values(payload)

    logger.info({
      event: "library_public_resource_ai_generate_success",
      module: "library",
      traceId,
      message: "AI 生成公共资源成功",
      durationMs: Date.now() - start
    })

    return { success: true }
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "library_public_resource_ai_generate_failed",
      module: "library",
      traceId,
      message: "AI 生成公共资源失败",
      durationMs: Date.now() - start,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return { success: false, message: anyErr?.message || "生成失败" }
  }
}
