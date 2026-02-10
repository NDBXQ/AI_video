import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { randomUUID } from "crypto"
import { generateImageByCoze } from "@/features/coze/imageClient"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { logger } from "@/shared/logger"
import { insertReferenceImageJob, type ReferenceImageJobPayload, type ReferenceImageJobSnapshot } from "@/server/domains/video-creation/jobs/referenceImageDbQueue"
import { kickReferenceImageWorker } from "@/server/domains/video-creation/jobs/referenceImageWorker"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { resolveStorageUrl } from "@/shared/storageUrl"

type PromptInput = {
  name: string
  prompt: string
  description?: string
  category: "background" | "role" | "item"
  generatedImageId?: string
}

type GenerateInput = {
  storyId?: string
  storyboardId?: string
  prompts: PromptInput[]
  forceRegenerate: boolean
  async: boolean
}

type ResultItem = {
  name: string
  category: string
  ok: boolean
  skipped?: boolean
  id?: string
  url?: string
  thumbnailUrl?: string | null
  errorMessage?: string
}

export class ImageGenerationService {
  static async generateImages(userId: string, input: GenerateInput, traceIdRaw?: string) {
    const traceId = traceIdRaw ?? "system"
    const { storyId: rawStoryId, storyboardId, prompts, forceRegenerate, async: asyncMode } = input
    const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

    const isNarrator = (name: string) => {
      const n = name.trim()
      if (!n) return false
      return n === "旁白" || n.toLowerCase() === "narrator"
    }

    const filteredPrompts = prompts.filter((p) => !(p.category === "role" && isNarrator(p.name)))

    const resolvedStoryId = rawStoryId ?? null
    const effectiveStoryId =
      resolvedStoryId ??
      (storyboardId
        ? (
            await db
              .select({ storyId: stories.id })
              .from(storyboards)
              .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
              .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
              .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
              .limit(1)
          )[0]?.storyId ?? null
        : null)

    if (!effectiveStoryId) {
      throw new Error("STORY_NOT_FOUND")
    }

    const allowed = await db
      .select({ id: stories.id, shotStyle: stories.shotStyle })
      .from(stories)
      .where(and(eq(stories.id, effectiveStoryId), eq(stories.userId, userId)))
      .limit(1)

    if (allowed.length === 0) {
      throw new Error("STORY_NOT_FOUND")
    }
    const storyStyle = allowed[0]?.shotStyle ?? null

    const storyboardIdForWrite = storyboardId
      ? (
          await db
            .select({ id: storyboards.id })
            .from(storyboards)
            .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
            .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
            .where(and(eq(storyboards.id, storyboardId), eq(stories.id, effectiveStoryId)))
            .limit(1)
        )[0]?.id ?? null
      : null

    if (filteredPrompts.length === 0) {
      logger.info({
        event: "video_creation_images_generate_skip",
        module: "video",
        traceId,
        message: "生成参考图跳过：过滤后无有效 prompts",
        storyId: effectiveStoryId,
        storyboardId: storyboardId ?? "",
        promptCount: prompts.length
      })
      return {
        async: false,
        storyId: effectiveStoryId,
        storyboardId: storyboardIdForWrite,
        results: [],
        summary: { total: 0, ok: 0, skipped: 0, failed: 0 }
      }
    }

    if (asyncMode) {
      const jobId = randomUUID()
      const createdAt = Date.now()
      const snapshot: ReferenceImageJobSnapshot = {
        jobId,
        status: "queued",
        storyId: effectiveStoryId,
        storyboardId: storyboardIdForWrite,
        createdAt,
        forceRegenerate,
        results: filteredPrompts.map((p) => ({ name: p.name, category: p.category, ok: false })),
        summary: { total: filteredPrompts.length, ok: 0, skipped: 0, failed: 0 }
      }

      await insertReferenceImageJob(
        {
          jobId,
          userId,
          storyId: effectiveStoryId,
          storyboardId: storyboardIdForWrite,
          prompts: filteredPrompts,
          forceRegenerate,
          traceId: traceId ?? "system"
        } satisfies ReferenceImageJobPayload,
        snapshot
      )
      kickReferenceImageWorker()

      logger.info({
        event: "video_creation_images_generate_async_queued",
        module: "video",
        traceId,
        message: "参考图生成任务已入队",
        storyId: effectiveStoryId,
        storyboardId: storyboardId ?? "",
        jobId,
        promptCount: filteredPrompts.length,
        forceRegenerate
      })

      return { async: true, jobId, status: snapshot.status }
    }

    // Sync Mode
    logger.info({
      event: "video_creation_images_generate_start",
      module: "video",
      traceId,
      message: "开始批量生成参考图",
      storyId: effectiveStoryId,
      storyboardId: storyboardId ?? "",
      promptCount: filteredPrompts.length,
      forceRegenerate
    })

    const storage = createCozeS3Storage()
    const results: ResultItem[] = Array.from({ length: filteredPrompts.length }, (_, i) => ({
      name: filteredPrompts[i]!.name,
      category: filteredPrompts[i]!.category,
      ok: false
    }))

    const processOne = async (p: PromptInput, index: number): Promise<void> => {
      const category = p.category
      try {
        const existing =
          p.generatedImageId
            ? (
                await db
                  .select({
                    id: generatedImages.id,
                    url: generatedImages.url,
                    thumbnailUrl: generatedImages.thumbnailUrl,
                    prompt: generatedImages.prompt
                  })
                  .from(generatedImages)
                  .where(and(eq(generatedImages.id, p.generatedImageId), eq(generatedImages.storyId, effectiveStoryId)))
                  .limit(1)
              )[0]
            : (
                await db
                  .select({
                    id: generatedImages.id,
                    url: generatedImages.url,
                    thumbnailUrl: generatedImages.thumbnailUrl,
                    prompt: generatedImages.prompt
                  })
                  .from(generatedImages)
                  .where(and(eq(generatedImages.storyId, effectiveStoryId), eq(generatedImages.name, p.name), eq(generatedImages.category, category)))
                  .orderBy(desc(generatedImages.createdAt))
                  .limit(1)
              )[0]
        const shouldSkip =
          Boolean(existing) &&
          !forceRegenerate &&
          typeof existing?.url === "string" &&
          existing.url.length > 0 &&
          (existing.prompt ?? "") === p.prompt

        if (shouldSkip) {
          results[index] = {
            name: p.name,
            category,
            ok: true,
            skipped: true,
            id: existing.id,
            url: existing.url,
            thumbnailUrl: existing.thumbnailUrl ?? null
          }
          return
        }

        const apiImageUrl = await generateImageByCoze(p.prompt, this.pickCozeImageType(category), { traceId, module: "video", style: storyStyle ?? undefined })
        const imageBuffer = await downloadImage(apiImageUrl, traceId)
        const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, traceId)

        const timestamp = Date.now()
        const safeName = makeSafeObjectKeySegment(p.name, 64)
        const originalFileKey = `generated_${effectiveStoryId}_${storyboardIdForWrite ?? "story"}_${index}_${safeName}_${timestamp}_original.jpg`
        const thumbnailFileKey = `generated_${effectiveStoryId}_${storyboardIdForWrite ?? "story"}_${index}_${safeName}_${timestamp}_thumbnail.jpg`

        const uploadedOriginalKey = await storage.uploadFile({ fileContent: imageBuffer, fileName: originalFileKey, contentType: "image/jpeg" })
        const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBuffer, fileName: thumbnailFileKey, contentType: "image/jpeg" })

        const originalSignedUrl = await resolveStorageUrl(storage, uploadedOriginalKey)
        const thumbnailSignedUrl = await resolveStorageUrl(storage, uploadedThumbnailKey)

        if (existing) {
          const [updated] = await db
            .update(generatedImages)
            .set({
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              prompt: p.prompt,
              description: p.description ?? p.prompt,
              name: p.name,
              category,
              storyboardId: storyboardIdForWrite
            })
            .where(eq(generatedImages.id, existing.id))
            .returning()

          results[index] = {
            name: p.name,
            category,
            ok: true,
            id: updated?.id ?? existing.id,
            url: updated?.url ?? originalSignedUrl,
            thumbnailUrl: updated?.thumbnailUrl ?? thumbnailSignedUrl
          }
        } else {
          const [created] = await db
            .insert(generatedImages)
            .values({
              storyId: effectiveStoryId,
              storyboardId: storyboardIdForWrite,
              name: p.name,
              description: p.description ?? p.prompt,
              url: originalSignedUrl,
              storageKey: uploadedOriginalKey,
              thumbnailUrl: thumbnailSignedUrl,
              thumbnailStorageKey: uploadedThumbnailKey,
              category,
              prompt: p.prompt
            })
            .returning()

          results[index] = {
            name: p.name,
            category,
            ok: true,
            id: created?.id,
            url: created?.url ?? originalSignedUrl,
            thumbnailUrl: created?.thumbnailUrl ?? thumbnailSignedUrl
          }
        }
      } catch (e) {
        const anyErr = e as { message?: string }
        results[index] = {
          name: p.name,
          category,
          ok: false,
          errorMessage: anyErr?.message ?? "生成失败"
        }
      }
    }

    for (let i = 0; i < filteredPrompts.length; i += 1) {
      const p = filteredPrompts[i]
      if (!p) continue
      await processOne(p, i)
    }

    const okCount = results.filter((r) => r.ok).length
    const skippedCount = results.filter((r) => r.ok && r.skipped).length
    const failedCount = results.filter((r) => !r.ok).length

    logger.info({
      event: "video_creation_images_generate_success",
      module: "video",
      traceId,
      message: "批量生成参考图完成",
      storyId: effectiveStoryId,
      storyboardId: storyboardId ?? "",
      okCount,
      skippedCount,
      failedCount
    })

    return {
      async: false,
      storyId: effectiveStoryId,
      storyboardId: storyboardIdForWrite,
      results,
      summary: { total: filteredPrompts.length, ok: okCount, skipped: skippedCount, failed: failedCount }
    }
  }

  private static pickCozeImageType(category: "background" | "role" | "item"): "background" | "role" | "item" {
    if (category === "role") return "role"
    if (category === "item") return "item"
    return "background"
  }
}
