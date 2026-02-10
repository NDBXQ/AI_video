import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq } from "drizzle-orm"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { resolveStorageUrl } from "@/shared/storageUrl"

function isFrameLikeName(value: string) {
  return /^镜\s*\d+\s*-\s*(首帧|尾帧)\s*$/u.test(value.trim())
}

export async function importVideoCreationImageByUrl(input: {
  traceId: string
  userId: string
  storyboardId: string
  url: string
  name: string
  category: string
  description?: string
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number }
> {
  if (!/^https?:\/\//i.test(input.url)) return { ok: false, code: "VALIDATION_FAILED", message: "仅支持 http(s) 图片 URL", status: 400 }

  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })
  const effectiveCategory = isFrameLikeName(input.name) ? "reference" : input.category

  const storyRow = await db
    .select({ storyId: stories.id })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
    .limit(1)

  const effectiveStoryId = storyRow[0]?.storyId ?? null
  if (!effectiveStoryId) return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const imageBuffer = await downloadImage(input.url, input.traceId)
  const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, input.traceId)

  const storage = createCozeS3Storage()
  const timestamp = Date.now()
  const safeName = makeSafeObjectKeySegment(input.name, 64)
  const originalFileKey = `frame_import_${effectiveStoryId}_${input.storyboardId}_${safeName}_${timestamp}_original.jpg`
  const thumbnailFileKey = `frame_import_${effectiveStoryId}_${input.storyboardId}_${safeName}_${timestamp}_thumbnail.jpg`

  const uploadedOriginalKey = await storage.uploadFile({ fileContent: imageBuffer, fileName: originalFileKey, contentType: "image/jpeg" })
  const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBuffer, fileName: thumbnailFileKey, contentType: "image/jpeg" })

  const originalSignedUrl = await resolveStorageUrl(storage, uploadedOriginalKey)
  const thumbnailSignedUrl = await resolveStorageUrl(storage, uploadedThumbnailKey)

  const existed = isFrameLikeName(input.name)
    ? await db
        .select({ id: generatedImages.id })
        .from(generatedImages)
        .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.storyboardId, input.storyboardId), eq(generatedImages.name, input.name)))
        .orderBy(desc(generatedImages.createdAt))
        .limit(1)
    : await db
        .select({ id: generatedImages.id })
        .from(generatedImages)
        .where(
          and(
            eq(generatedImages.storyId, effectiveStoryId),
            eq(generatedImages.storyboardId, input.storyboardId),
            eq(generatedImages.name, input.name),
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
              description: input.description ?? null,
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
              storyboardId: input.storyboardId,
              name: input.name,
              description: input.description ?? null,
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              category: effectiveCategory
            })
            .returning()
        )[0]

  return { ok: true, data: { ...(saved as any) } }
}
