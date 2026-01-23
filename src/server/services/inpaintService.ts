import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { logger } from "@/shared/logger"
import { generateThumbnail } from "@/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { generatedImages, stories } from "@/shared/schema"
import sharp from "sharp"

async function fetchImageBytes(url: string, traceId: string, event: string): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch (err) {
    const anyErr = err as { name?: string; message?: string }
    logger.error({
      event,
      module: "video",
      traceId,
      message: "图片下载失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function bakeSelectionBoxToS3(params: {
  traceId: string
  sourceUrl: string
  selection: { x: number; y: number; w: number; h: number }
  storyboardId?: string | null
}): Promise<string> {
  const { traceId, sourceUrl, selection, storyboardId } = params
  const start = Date.now()
  const bytes = await fetchImageBytes(sourceUrl, traceId, "inpaint_input_fetch_failed")

  const img = sharp(bytes, { failOnError: false })
  const meta = await img.metadata()
  const width = Number(meta.width) || 0
  const height = Number(meta.height) || 0
  if (width <= 0 || height <= 0) throw new Error("Invalid image metadata")

  const left = Math.max(0, Math.min(width - 1, Math.round(selection.x * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(selection.y * height)))
  const rectW = Math.max(1, Math.min(width - left, Math.round(selection.w * width)))
  const rectH = Math.max(1, Math.min(height - top, Math.round(selection.h * height)))
  const strokeW = Math.max(2, Math.round(Math.min(width, height) * 0.004))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${left}" y="${top}" width="${rectW}" height="${rectH}" fill="none" stroke="rgba(99,102,241,0.95)" stroke-width="${strokeW}"/></svg>`
  const baked = await img
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()

  const storage = createCozeS3Storage()
  const ts = Date.now()
  const safe = makeSafeObjectKeySegment(`inpaint_${storyboardId ?? "story"}_${traceId}`, 64)
  const key = `inpaint_${storyboardId ?? "story"}_${safe}_${ts}.jpg`
  const uploadedKey = await storage.uploadFile({ fileContent: baked, fileName: key, contentType: "image/jpeg" })
  const signedUrl = await storage.generatePresignedUrl({ key: uploadedKey, expireTime: 604800 })

  const durationMs = Date.now() - start
  logger.info({
    event: "inpaint_input_bake_success",
    module: "video",
    traceId,
    message: "生成带框输入图成功",
    durationMs
  })

  return signedUrl
}

export async function overwriteGeneratedImage(params: {
  traceId: string
  userId: string
  generatedImageId: string
  storyboardId?: string | null
  sourceUrl: string
}): Promise<{ url: string }> {
  const { traceId, userId, generatedImageId, storyboardId, sourceUrl } = params
  const start = Date.now()

  const db = await getDb({ generatedImages, stories })
  const allowed =
    (
      await db
        .select({
          id: generatedImages.id,
          storyId: generatedImages.storyId
        })
        .from(generatedImages)
        .innerJoin(stories, eq(generatedImages.storyId, stories.id))
        .where(and(eq(generatedImages.id, generatedImageId), eq(stories.userId, userId)))
        .limit(1)
    )[0] ?? null

  if (!allowed) {
    throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" as const })
  }

  logger.info({
    event: "inpaint_overwrite_start",
    module: "video",
    traceId,
    message: "开始覆盖生成图片数据库记录",
    generatedImageId
  })

  const rawBytes = await fetchImageBytes(sourceUrl, traceId, "inpaint_output_fetch_failed")
  const jpegBytes = await sharp(rawBytes, { failOnError: false }).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
  const thumbnailBytes = await generateThumbnail(jpegBytes, 300, traceId)

  const storage = createCozeS3Storage()
  const timestamp = Date.now()
  const safe = makeSafeObjectKeySegment(`inpaint_${generatedImageId}_${traceId}`, 64)
  const originalFileKey = `inpaint_overwrite_${allowed.storyId}_${storyboardId ?? "story"}_${safe}_${timestamp}_original.jpg`
  const thumbnailFileKey = `inpaint_overwrite_${allowed.storyId}_${storyboardId ?? "story"}_${safe}_${timestamp}_thumbnail.jpg`

  const uploadedOriginalKey = await storage.uploadFile({ fileContent: jpegBytes, fileName: originalFileKey, contentType: "image/jpeg" })
  const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBytes, fileName: thumbnailFileKey, contentType: "image/jpeg" })

  const originalSignedUrl = await storage.generatePresignedUrl({ key: uploadedOriginalKey, expireTime: 604800 })
  const thumbnailSignedUrl = await storage.generatePresignedUrl({ key: uploadedThumbnailKey, expireTime: 604800 })

  await db
    .update(generatedImages)
    .set({
      url: originalSignedUrl,
      storageKey: uploadedOriginalKey,
      thumbnailUrl: thumbnailSignedUrl,
      thumbnailStorageKey: uploadedThumbnailKey
    })
    .where(eq(generatedImages.id, generatedImageId))

  const durationMs = Date.now() - start
  logger.info({
    event: "inpaint_overwrite_success",
    module: "video",
    traceId,
    message: "覆盖生成图片数据库记录成功",
    generatedImageId,
    durationMs
  })

  return { url: originalSignedUrl }
}

