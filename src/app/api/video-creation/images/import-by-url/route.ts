import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { downloadImage, generateThumbnail } from "@/lib/thumbnail"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"

export const runtime = "nodejs"

const bodySchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(4000),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(50).default("background"),
  description: z.string().trim().max(10_000).optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyboardId, url, name, category, description } = parsed.data
  if (!/^https?:\/\//i.test(url)) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "仅支持 http(s) 图片 URL"), { status: 400 })

  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

  const isFrameLikeName = (value: string) => /^镜\s*\d+\s*-\s*(首帧|尾帧)\s*$/u.test(value.trim())
  const effectiveCategory = isFrameLikeName(name) ? "reference" : category

  const storyRow = await db
    .select({ storyId: stories.id })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
    .limit(1)

  const effectiveStoryId = storyRow[0]?.storyId ?? null
  if (!effectiveStoryId) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const imageBuffer = await downloadImage(url, traceId)
  const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)

  const storage = createCozeS3Storage()
  const timestamp = Date.now()
  const safeName = makeSafeObjectKeySegment(name, 64)
  const originalFileKey = `frame_import_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_original.jpg`
  const thumbnailFileKey = `frame_import_${effectiveStoryId}_${storyboardId}_${safeName}_${timestamp}_thumbnail.jpg`

  const uploadedOriginalKey = await storage.uploadFile({ fileContent: imageBuffer, fileName: originalFileKey, contentType: "image/jpeg" })
  const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBuffer, fileName: thumbnailFileKey, contentType: "image/jpeg" })

  const originalSignedUrl = await storage.generatePresignedUrl({ key: uploadedOriginalKey, expireTime: 604800 })
  const thumbnailSignedUrl = await storage.generatePresignedUrl({ key: uploadedThumbnailKey, expireTime: 604800 })

  const existed = isFrameLikeName(name)
    ? await db
        .select({ id: generatedImages.id })
        .from(generatedImages)
        .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.storyboardId, storyboardId), eq(generatedImages.name, name)))
        .orderBy(desc(generatedImages.createdAt))
        .limit(1)
    : await db
        .select({ id: generatedImages.id })
        .from(generatedImages)
        .where(
          and(
            eq(generatedImages.storyId, effectiveStoryId),
            eq(generatedImages.storyboardId, storyboardId),
            eq(generatedImages.name, name),
            eq(generatedImages.category, effectiveCategory)
          )
        )
        .orderBy(desc(generatedImages.createdAt))
        .limit(1)

  const existing = existed[0]
  const saved =
    existing
      ? (
          await db
            .update(generatedImages)
            .set({
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              description: description ?? null,
              category: effectiveCategory
            })
            .where(eq(generatedImages.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(generatedImages)
            .values({
              storyId: effectiveStoryId,
              storyboardId,
              name,
              description: description ?? null,
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              category: effectiveCategory
            })
            .returning()
        )[0]

  return NextResponse.json(makeApiOk(traceId, saved), { status: 200 })
}
