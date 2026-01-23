import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { generateThumbnail } from "@/lib/thumbnail"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"

const formSchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(50).default("reference"),
  description: z.string().trim().max(10_000).optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json(makeApiErr(traceId, "INVALID_FORM", "上传表单解析失败"), { status: 400 })

  const file = formData.get("file")
  const parsed = formSchema.safeParse({
    storyId: formData.get("storyId") ?? undefined,
    storyboardId: formData.get("storyboardId") ?? undefined,
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? undefined,
    description: formData.get("description") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  if (!(file instanceof File)) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少上传文件"), { status: 400 })

  const { storyId: rawStoryId, storyboardId, name, category, description } = parsed.data
  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

  const effectiveStoryId =
    rawStoryId ??
    (
      storyboardId
        ? (
            await db
              .select({ storyId: stories.id })
              .from(storyboards)
              .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
              .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
              .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
              .limit(1)
          )[0]?.storyId ?? null
        : null
    )

  if (!effectiveStoryId) {
    return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })
  }

  const allowed = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, effectiveStoryId), eq(stories.userId, userId)))
    .limit(1)
  if (allowed.length === 0) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const thumbnail = await generateThumbnail(bytes, 300, traceId)

  const storage = createCozeS3Storage()
  const timestamp = Date.now()
  const safeName = makeSafeObjectKeySegment(name, 64)
  const originalFileKey = `upload_${effectiveStoryId}_${storyboardId ?? "story"}_${safeName}_${timestamp}_original.jpg`
  const thumbnailFileKey = `upload_${effectiveStoryId}_${storyboardId ?? "story"}_${safeName}_${timestamp}_thumbnail.jpg`

  const uploadedOriginalKey = await storage.uploadFile({ fileContent: bytes, fileName: originalFileKey, contentType: file.type || "image/jpeg" })
  const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnail, fileName: thumbnailFileKey, contentType: "image/jpeg" })

  const originalSignedUrl = await storage.generatePresignedUrl({ key: uploadedOriginalKey, expireTime: 604800 })
  const thumbnailSignedUrl = await storage.generatePresignedUrl({ key: uploadedThumbnailKey, expireTime: 604800 })

  const existed = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.name, name), eq(generatedImages.category, category)))
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
              description: description ?? null
            })
            .where(eq(generatedImages.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(generatedImages)
            .values({
              storyId: effectiveStoryId,
              storyboardId: storyboardId ?? null,
              name,
              description: description ?? null,
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              category
            })
            .returning()
        )[0]

  void storyboardId

  return NextResponse.json(makeApiOk(traceId, saved), { status: 200 })
}
