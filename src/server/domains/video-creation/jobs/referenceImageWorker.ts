import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { generateImageByCoze } from "@/features/coze/imageClient"
import { downloadImage, generateThumbnail } from "@/server/lib/thumbnail"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { logger } from "@/shared/logger"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { resolveStorageUrl } from "@/shared/storageUrl"
import {
  getJobPayload,
  persistJobSnapshot,
  tryClaimNextReferenceImageJob,
  type ReferenceImageJobPayload,
  type ReferenceImageJobSnapshot
} from "./referenceImageDbQueue"

function pickCozeImageType(category: "background" | "role" | "item"): "background" | "role" | "item" {
  if (category === "role") return "role"
  if (category === "item") return "item"
  return "background"
}

function recomputeSummary(results: ReferenceImageJobSnapshot["results"]): ReferenceImageJobSnapshot["summary"] {
  const okCount = results.filter((r) => r.ok).length
  const skippedCount = results.filter((r) => r.ok && r.skipped).length
  const failedCount = results.filter((r) => !r.ok).length
  return { total: results.length, ok: okCount, skipped: skippedCount, failed: failedCount }
}

function isNarratorName(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  return n === "旁白" || n.toLowerCase() === "narrator"
}

async function setResult(jobId: string, snapshot: ReferenceImageJobSnapshot, index: number, result: ReferenceImageJobSnapshot["results"][number]): Promise<ReferenceImageJobSnapshot> {
  const nextResults = snapshot.results.slice()
  nextResults[index] = result
  const next: ReferenceImageJobSnapshot = { ...snapshot, results: nextResults, summary: recomputeSummary(nextResults) }
  await persistJobSnapshot(jobId, next)
  return next
}

async function runOneJob(payload: ReferenceImageJobPayload, snapshot: ReferenceImageJobSnapshot): Promise<void> {
  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })
  const storage = createCozeS3Storage()

  const allowed = await db
    .select({ id: stories.id, shotStyle: stories.shotStyle })
    .from(stories)
    .where(and(eq(stories.id, payload.storyId), eq(stories.userId, payload.userId)))
    .limit(1)
  if (allowed.length === 0) {
    const errSnap: ReferenceImageJobSnapshot = { ...snapshot, status: "error", errorMessage: "未找到可用的故事", finishedAt: Date.now() }
    await persistJobSnapshot(payload.jobId, errSnap, { errorMessage: errSnap.errorMessage, finished: true })
    return
  }
  const storyStyle = allowed[0]?.shotStyle ?? null

  let cur: ReferenceImageJobSnapshot = snapshot
  let firstErrorMessage: string | null = null
  let updateChain: Promise<unknown> = Promise.resolve()

  const enqueueUpdate = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = updateChain.then(fn, fn)
    updateChain = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  const updateResult = async (index: number, result: ReferenceImageJobSnapshot["results"][number]) => {
    await enqueueUpdate(async () => {
      cur = await setResult(payload.jobId, cur, index, result)
    })
  }

  const promptTasks = payload.prompts.map((p, index) => async () => {
    const category = p.category
    if (category === "role" && isNarratorName(p.name)) {
      await updateResult(index, { name: p.name, category, ok: true, skipped: true })
      return
    }
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
                .where(and(eq(generatedImages.id, p.generatedImageId), eq(generatedImages.storyId, payload.storyId)))
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
                .where(and(eq(generatedImages.storyId, payload.storyId), eq(generatedImages.name, p.name), eq(generatedImages.category, category)))
                .orderBy(desc(generatedImages.createdAt))
                .limit(1)
            )[0]

      const shouldSkip =
        Boolean(existing) &&
        !payload.forceRegenerate &&
        typeof existing?.url === "string" &&
        existing.url.length > 0 &&
        (existing.prompt ?? "") === p.prompt

      if (shouldSkip) {
        await updateResult(index, {
          name: p.name,
          category,
          ok: true,
          skipped: true,
          id: existing.id,
          url: existing.url,
          thumbnailUrl: existing.thumbnailUrl ?? null
        })
        return
      }

      const apiImageUrl = await generateImageByCoze(p.prompt, pickCozeImageType(category), { traceId: payload.traceId, module: "video", style: storyStyle ?? undefined })
      const imageBuffer = await downloadImage(apiImageUrl, payload.traceId)
      const thumbnailBuffer = await generateThumbnail(imageBuffer, 300, payload.traceId)

      const timestamp = Date.now()
      const safeName = makeSafeObjectKeySegment(p.name, 64)
      const originalFileKey = `generated_${payload.storyId}_${payload.storyboardId ?? "story"}_${index}_${safeName}_${timestamp}_original.jpg`
      const thumbnailFileKey = `generated_${payload.storyId}_${payload.storyboardId ?? "story"}_${index}_${safeName}_${timestamp}_thumbnail.jpg`

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
            storyboardId: payload.storyboardId
          })
          .where(eq(generatedImages.id, existing.id))
          .returning()

        await updateResult(index, {
          name: p.name,
          category,
          ok: true,
          id: updated?.id ?? existing.id,
          url: updated?.url ?? originalSignedUrl,
          thumbnailUrl: updated?.thumbnailUrl ?? thumbnailSignedUrl
        })
        return
      }

      const [created] = await db
        .insert(generatedImages)
        .values({
          storyId: payload.storyId,
          storyboardId: payload.storyboardId,
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

      await updateResult(index, {
        name: p.name,
        category,
        ok: true,
        id: created?.id,
        url: created?.url ?? originalSignedUrl,
        thumbnailUrl: created?.thumbnailUrl ?? thumbnailSignedUrl
      })
    } catch (e) {
      const anyErr = e as { message?: unknown }
      const errorMessage = typeof anyErr?.message === "string" ? anyErr.message : "生成失败"
      if (!firstErrorMessage) firstErrorMessage = errorMessage
      await updateResult(index, { name: p.name, category, ok: false, errorMessage })
    }
  })

  const rawConcurrency = Number(process.env.REFERENCE_IMAGE_CONCURRENCY ?? 3)
  const concurrency = Math.max(1, Math.min(payload.prompts.length, Number.isFinite(rawConcurrency) ? Math.trunc(rawConcurrency) : 3))
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, promptTasks.length) }, async () => {
    while (true) {
      const i = cursor
      cursor += 1
      const task = promptTasks[i]
      if (!task) break
      await task()
    }
  })
  await Promise.all(runners)
  await updateChain

  const failedCount = cur.summary.failed
  const finishedAt = Date.now()
  if (failedCount > 0) {
    const errSnap: ReferenceImageJobSnapshot = {
      ...cur,
      status: "error",
      errorMessage: firstErrorMessage ?? "部分生成失败",
      finishedAt
    }
    await persistJobSnapshot(payload.jobId, errSnap, { errorMessage: errSnap.errorMessage, finished: true })
    return
  }

  const doneSnap: ReferenceImageJobSnapshot = { ...cur, status: "done", finishedAt }
  await persistJobSnapshot(payload.jobId, doneSnap, { finished: true })
}

class ReferenceImageDbWorker {
  private running = false

  kick(): void {
    if (this.running) return
    this.running = true
    void this.runLoop()
  }

  private async runLoop(): Promise<void> {
    try {
      while (true) {
        const claimed = await tryClaimNextReferenceImageJob()
        if (!claimed) break
        const loaded = await getJobPayload(claimed.jobId)
        if (!loaded) continue
        const payload = loaded.payload
        const snapshot = loaded.snapshot
        await runOneJob(payload, snapshot)
      }
    } catch (e) {
      const anyErr = e as { name?: unknown; message?: unknown; stack?: unknown }
      const errorName = typeof anyErr?.name === "string" ? anyErr.name : undefined
      const errorMessage = typeof anyErr?.message === "string" ? anyErr.message : "unknown error"
      const stack = typeof anyErr?.stack === "string" ? anyErr.stack : undefined
      logger.error({
        event: "reference_image_job_worker_failed",
        module: "video",
        traceId: "server",
        message: "参考图异步任务 worker 异常",
        errorName,
        errorMessage,
        stack
      })
    } finally {
      this.running = false
    }
  }
}

export function kickReferenceImageWorker(): void {
  const g = globalThis as any
  const existing = g.__referenceImageDbWorker as any
  if (existing && typeof existing === "object" && existing.__version !== 2 && existing.running === true) existing.running = false
  if (!existing || existing.__version !== 2) {
    const worker = new ReferenceImageDbWorker() as any
    worker.__version = 2
    g.__referenceImageDbWorker = worker
  }
  ;(g.__referenceImageDbWorker as ReferenceImageDbWorker).kick()
}
