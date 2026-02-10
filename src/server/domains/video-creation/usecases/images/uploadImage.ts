import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq } from "drizzle-orm"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards, type StoryboardScriptContent } from "@/shared/schema/story"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { generateThumbnail } from "@/server/lib/thumbnail"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { resolveStorageUrl } from "@/shared/storageUrl"
import { buildEmptyScript, withReferenceAsset } from "@/server/domains/video-creation/lib/storyboardScript"

export async function uploadVideoCreationImage(input: {
  traceId: string
  userId: string
  storyId?: string
  storyboardId?: string
  name: string
  displayName?: string
  category: string
  description?: string
  file: File
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number }
> {
  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

  const effectiveStoryId =
    input.storyId ??
    (input.storyboardId
      ? (
          await db
            .select({ storyId: stories.id })
            .from(storyboards)
            .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
            .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
            .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
            .limit(1)
        )[0]?.storyId ?? null
      : null)

  if (!effectiveStoryId) return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const allowed = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, effectiveStoryId), eq(stories.userId, input.userId)))
    .limit(1)
  if (allowed.length === 0) return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const bytes = Buffer.from(await input.file.arrayBuffer())
  const thumbnail = await generateThumbnail(bytes, 300, input.traceId)

  const storage = createCozeS3Storage()
  const timestamp = Date.now()
  const safeName = makeSafeObjectKeySegment(input.name, 64)
  const originalFileKey = `upload_${effectiveStoryId}_${input.storyboardId ?? "story"}_${safeName}_${timestamp}_original.jpg`
  const thumbnailFileKey = `upload_${effectiveStoryId}_${input.storyboardId ?? "story"}_${safeName}_${timestamp}_thumbnail.jpg`

  const uploadedOriginalKey = await storage.uploadFile({ fileContent: bytes, fileName: originalFileKey, contentType: input.file.type || "image/jpeg" })
  const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnail, fileName: thumbnailFileKey, contentType: "image/jpeg" })

  const originalSignedUrl = await resolveStorageUrl(storage, uploadedOriginalKey)
  const thumbnailSignedUrl = await resolveStorageUrl(storage, uploadedThumbnailKey)

  const existed = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.name, input.name), eq(generatedImages.category, input.category)))
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
              description: input.description ?? null
            })
            .where(eq(generatedImages.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(generatedImages)
            .values({
              storyId: effectiveStoryId,
              storyboardId: input.storyboardId ?? null,
              name: input.name,
              description: input.description ?? null,
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              category: input.category
            })
            .returning()
        )[0]

  if (input.storyboardId) {
    const rows = await db
      .select({ scriptContent: storyboards.scriptContent })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
      .limit(1)
    const current = (rows[0]?.scriptContent ?? null) as StoryboardScriptContent | null
    const assetName = (input.file.name ?? "").trim() || input.displayName || input.name
    const assetDescription = (input.description ?? "").trim()
    const nextScript = withReferenceAsset(current ?? buildEmptyScript(), { category: input.category, entityName: input.name, assetName, assetDescription })
    await db.update(storyboards).set({ scriptContent: nextScript, updatedAt: new Date() }).where(eq(storyboards.id, input.storyboardId))
  }

  return { ok: true, data: { ...(saved as any) } }
}
