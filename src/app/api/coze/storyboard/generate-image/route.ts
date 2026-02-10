import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyboards } from "@/shared/schema/story"
import { generateImageByCoze } from "@/features/coze/imageClient"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { mergeStoryboardFrames } from "@/server/shared/storyboard/storyboardAssets"
import { resolveStorageUrl } from "@/shared/storageUrl"

const inputSchema = z.object({
  storyId: z.string().min(1),
  storyboardId: z.string().min(1),
  prompt: z.string().min(1),
  name: z.string().optional(),
  category: z.enum(["background", "role", "item", "reference"]).default("reference"),
  forceRegenerate: z.boolean().default(false)
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "generate_image_start",
    module: "coze",
    traceId,
    message: "开始生成参考图"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), {
      status: 400
    })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const { storyId, storyboardId, prompt, name, category } = parsed.data

  try {
    const db = await getDb({ storyboards, generatedImages, stories })
    const storyStyle =
      (
        await db
          .select({ shotStyle: stories.shotStyle })
          .from(stories)
          .where(eq(stories.id, storyId))
          .limit(1)
      )[0]?.shotStyle ?? null

    // 1. Call Coze
    const apiImageUrl = await generateImageByCoze(prompt, category as "background" | "role" | "item", { traceId, module: "coze", style: storyStyle ?? undefined })
    
    // 2. Download Image
    const imageBuffer = await downloadImage(apiImageUrl, traceId)
    
    // 3. Generate Thumbnail
    const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)

    // 4. Upload to OSS
    const storage = createCozeS3Storage()
    const timestamp = Date.now()
    const originalFileKey = `generated_${storyId}_${storyboardId}_${timestamp}_original.jpg`
    const thumbnailFileKey = `generated_${storyId}_${storyboardId}_${timestamp}_thumbnail.jpg`

    // Upload Original
    const uploadedOriginalKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: originalFileKey,
      contentType: 'image/jpeg',
    })
    const originalSignedUrl = await resolveStorageUrl(storage, uploadedOriginalKey)

    // Upload Thumbnail
    const uploadedThumbnailKey = await storage.uploadFile({
      fileContent: thumbnailBuffer,
      fileName: thumbnailFileKey,
      contentType: 'image/jpeg',
    })
    const thumbnailSignedUrl = await resolveStorageUrl(storage, uploadedThumbnailKey)

    // 5. Save to DB
    // Insert into generated_images
    const [newImage] = await db.insert(generatedImages).values({
      storyId,
      storyboardId,
      name: name || `Reference for ${storyboardId}`,
      description: prompt,
      url: originalSignedUrl,
      storageKey: uploadedOriginalKey,
      thumbnailUrl: thumbnailSignedUrl,
      thumbnailStorageKey: uploadedThumbnailKey,
      category,
      prompt
    }).returning()

    const existing = await db
      .select({ frames: storyboards.frames })
      .from(storyboards)
      .where(eq(storyboards.id, storyboardId))
      .limit(1)
    const nextFrames = mergeStoryboardFrames(existing[0]?.frames as any, { first: { prompt } })
    await db.update(storyboards)
      .set({
        frames: nextFrames as any,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, storyboardId))

    const durationMs = Date.now() - start
    logger.info({
      event: "generate_image_success",
      module: "coze",
      traceId,
      message: "参考图生成并入库成功",
      durationMs,
      imageUrl: originalSignedUrl
    })

    return NextResponse.json(makeApiOk(traceId, newImage), { status: 200 })

  } catch (err) {
    const anyErr = err as { message?: string; stack?: string }
    logger.error({
      event: "generate_image_failed",
      module: "coze",
      traceId,
      message: "参考图生成失败",
      error: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "GENERATION_FAILED", anyErr?.message || "生成失败"), {
      status: 500
    })
  }
}
