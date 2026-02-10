import { and, desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv, readEnvInt } from "@/shared/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { logger } from "@/shared/logger"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { resolveStorageUrl } from "@/shared/storageUrl"
import { getJobById, insertJob, tryClaimNextJob, updateJob, type JobStatus } from "@/server/framework/jobs/jobDb"
import { createHash, randomUUID } from "crypto"

export const VIDEO_GENERATE_JOB_TYPE = "video_generate"

type VideoGenerateJobPayload = {
  jobId: string
  userId: string
  traceId: string
  storyId: string | null
  storyboardId: string | null
  prompt: string
  mode: string
  ratio: string
  resolution: string
  duration: number
  generateAudio: boolean
  watermark: boolean
  first_image: { url: string; file_type: string }
  last_image: { url: string; file_type: string } | null
  return_last_frame: boolean
  forceRegenerate: boolean
  existingVideoStorageKey: string | null
}

type VideoGenerateJobSnapshot = {
  jobId: string
  status: JobStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  storyId: string | null
  storyboardId: string | null
  stage: "queued" | "running" | "reuse" | "coze" | "download" | "upload" | "write_db" | "done" | "error"
  video?: { url: string; mode: string }
  errorMessage?: string
}

function extractVideoUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const anyData = data as Record<string, unknown>
  const candidates = [anyData["generated_video_url"], anyData["video_url"], anyData["extracted_video_url"], anyData["data"], anyData["url"]]
  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("http")) return value
  }
  if (anyData["data"] && typeof anyData["data"] === "object") {
    const nested = extractVideoUrl(anyData["data"])
    if (nested) return nested
  }
  return undefined
}

async function persistSnapshot(jobId: string, snap: VideoGenerateJobSnapshot, opts?: { errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await updateJob(jobId, { status: snap.status, snapshot: snap as unknown as Record<string, unknown>, errorMessage: opts?.errorMessage, finished: opts?.finished })
}

async function runVideoJob(payload: VideoGenerateJobPayload, snapshot: VideoGenerateJobSnapshot): Promise<void> {
  const db = await getDb({ stories, storyOutlines, storyboards })
  const storage = createCozeS3Storage()

  let cur: VideoGenerateJobSnapshot = { ...snapshot, status: "running", stage: "running", startedAt: Date.now() }
  await persistSnapshot(payload.jobId, cur)

  if (!payload.forceRegenerate && payload.existingVideoStorageKey) {
    cur = { ...cur, stage: "reuse" }
    await persistSnapshot(payload.jobId, cur)
    const url = await resolveStorageUrl(storage, payload.existingVideoStorageKey)
    const done: VideoGenerateJobSnapshot = { ...cur, status: "done", stage: "done", finishedAt: Date.now(), video: { url, mode: payload.mode } }
    await persistSnapshot(payload.jobId, done, { finished: true })
    return
  }

  const token = readEnv("VIDEO_GENERATE_API_TOKEN")
  const url = readEnv("VIDEO_GENERATE_API_URL") ?? "https://3f47zmnfcb.coze.site/run"
  if (!token) {
    const msg = "Coze 未配置，请设置 VIDEO_GENERATE_API_TOKEN（URL 可选）"
    const errSnap: VideoGenerateJobSnapshot = { ...cur, status: "error", stage: "error", errorMessage: msg, finishedAt: Date.now() }
    await persistSnapshot(payload.jobId, errSnap, { errorMessage: msg, finished: true })
    return
  }

  cur = { ...cur, stage: "coze" }
  await persistSnapshot(payload.jobId, cur)

  let cozeData: unknown
  try {
    const timeoutMs = readEnvInt("VIDEO_REQUEST_TIMEOUT_MS") ?? 120_000
    const coze = await callCozeRunEndpoint({
      traceId: payload.traceId,
      url,
      token,
      timeoutMs,
      module: "video",
      body: {
        prompt: payload.prompt.trim(),
        mode: payload.mode,
        first_image: payload.first_image,
        last_image: payload.last_image,
        return_last_frame: payload.return_last_frame,
        generate_audio: payload.generateAudio,
        ratio: payload.ratio,
        resolution: payload.resolution,
        duration: payload.duration,
        watermark: payload.watermark,
      }
    })
    cozeData = coze.data
  } catch (err) {
    const msg = err instanceof CozeRunEndpointError ? "Coze 调用失败，请稍后重试" : "生成视频失败"
    logger.error({
      event: "video_generate_job_failed",
      module: "video",
      traceId: payload.traceId,
      message: "视频生成任务失败",
      jobId: payload.jobId,
      errorName: (err as any)?.name,
      errorMessage: (err as any)?.message
    })
    const errSnap: VideoGenerateJobSnapshot = { ...cur, status: "error", stage: "error", errorMessage: msg, finishedAt: Date.now() }
    await persistSnapshot(payload.jobId, errSnap, { errorMessage: msg, finished: true })
    return
  }

  const cozeVideoUrl = extractVideoUrl(cozeData)
  if (!cozeVideoUrl) {
    const msg = "生成结果缺少可用视频 URL"
    const errSnap: VideoGenerateJobSnapshot = { ...cur, status: "error", stage: "error", errorMessage: msg, finishedAt: Date.now() }
    await persistSnapshot(payload.jobId, errSnap, { errorMessage: msg, finished: true })
    return
  }

  cur = { ...cur, stage: "download" }
  await persistSnapshot(payload.jobId, cur)

  const resp = await fetch(cozeVideoUrl)
  if (!resp.ok) {
    const msg = `下载视频失败: ${resp.status}`
    const errSnap: VideoGenerateJobSnapshot = { ...cur, status: "error", stage: "error", errorMessage: msg, finishedAt: Date.now() }
    await persistSnapshot(payload.jobId, errSnap, { errorMessage: msg, finished: true })
    return
  }
  const buf = Buffer.from(await resp.arrayBuffer())

  cur = { ...cur, stage: "upload" }
  await persistSnapshot(payload.jobId, cur)

  const timestamp = Date.now()
  const safeName = makeSafeObjectKeySegment(`video_${payload.storyboardId ?? payload.storyId ?? "story"}_${payload.mode}`, 64)
  const fileKey = `generated_${payload.storyId ?? "story"}_${payload.storyboardId ?? "unknown"}_${safeName}_${timestamp}.mp4`

  const uploadedKey = await storage.uploadFile({ fileContent: buf, fileName: fileKey, contentType: "video/mp4" })
  const signedUrl = await resolveStorageUrl(storage, uploadedKey)

  cur = { ...cur, stage: "write_db" }
  await persistSnapshot(payload.jobId, cur)

  if (payload.storyboardId) {
    await db
      .update(storyboards)
      .set({
        isVideoGenerated: true,
        videoInfo: {
          url: signedUrl,
          storageKey: uploadedKey,
          durationSeconds: payload.duration,
          prompt: payload.prompt.trim(),
          settings: { mode: payload.mode, generateAudio: payload.generateAudio, watermark: payload.watermark }
        } as any,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, payload.storyboardId))
  }

  const done: VideoGenerateJobSnapshot = { ...cur, status: "done", stage: "done", finishedAt: Date.now(), video: { url: signedUrl, mode: payload.mode } }
  await persistSnapshot(payload.jobId, done, { finished: true })
}

class VideoGenerateDbWorker {
  private running = false

  kick(): void {
    if (this.running) return
    this.running = true
    void this.runLoop()
  }

  private async runLoop(): Promise<void> {
    try {
      while (true) {
        const claimed = await tryClaimNextJob(VIDEO_GENERATE_JOB_TYPE)
        if (!claimed) break
        const row = await getJobById(claimed.jobId)
        if (!row) continue
        const payload = row.payload as unknown as VideoGenerateJobPayload
        const snapshot = row.snapshot as unknown as VideoGenerateJobSnapshot
        await runVideoJob(payload, snapshot)
      }
    } catch (e) {
      logger.error({
        event: "video_generate_job_worker_failed",
        module: "video",
        traceId: "server",
        message: "视频生成 job worker 异常",
        errorName: (e as any)?.name,
        errorMessage: (e as any)?.message,
        stack: (e as any)?.stack
      })
    } finally {
      this.running = false
    }
  }
}

export async function enqueueVideoGenerateJob(input: Omit<VideoGenerateJobPayload, "jobId">): Promise<{ jobId: string; snapshot: VideoGenerateJobSnapshot }> {
  const jobId = randomUUID()
  const createdAt = Date.now()
  const snapshot: VideoGenerateJobSnapshot = {
    jobId,
    status: "queued",
    createdAt,
    storyId: input.storyId,
    storyboardId: input.storyboardId,
    stage: "queued"
  }
  const payload: VideoGenerateJobPayload = { ...input, jobId }
  await insertJob({
    jobId,
    userId: input.userId,
    type: VIDEO_GENERATE_JOB_TYPE,
    status: "queued",
    storyId: input.storyId,
    storyboardId: input.storyboardId,
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>
  })
  return { jobId, snapshot }
}

export function kickVideoGenerateWorker(): void {
  const g = globalThis as any
  const existing = g.__videoGenerateDbWorker as any
  if (existing && typeof existing === "object" && existing.__version !== 1 && existing.running === true) existing.running = false
  if (!existing || existing.__version !== 1) {
    const worker = new VideoGenerateDbWorker() as any
    worker.__version = 1
    g.__videoGenerateDbWorker = worker
  }
  ;(g.__videoGenerateDbWorker as VideoGenerateDbWorker).kick()
}
