import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { logger } from "@/shared/logger"
import { tvcStories, tvcStoryOutlines } from "@/shared/schema/tvc"
import { insertTvcJob, tryClaimNextTvcJob, updateTvcJob, getTvcJobById, type JobStatus } from "./tvcJobDb"
import { runGenerateTvcOutline, runGenerateTvcStoryboardText } from "../integrations/cozeStoryboardTasks"

export const TVC_GENERATE_SHOTLIST_JOB_TYPE = "tvc_generate_shotlist"

type TvcShotlistJobPayload = {
  jobId: string
  userId: string
  traceId: string
  storyId: string
  brief: string
  durationSec: number
  ratio?: string
  resolution?: string
}

type TvcJobSnapshot = {
  jobId: string
  status: JobStatus
  stage: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  errorMessage?: string
  progress?: {
    outlineTotal?: number
    outlineDone?: number
    shotTotal?: number
    currentOutlineId?: string | null
    currentOutlineIndex?: number
  }
  result?: unknown
}

async function persist(jobId: string, snapshot: TvcJobSnapshot, opts?: { errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await updateTvcJob(jobId, {
    status: snapshot.status,
    snapshot: snapshot as unknown as Record<string, unknown>,
    errorMessage: opts?.errorMessage ?? snapshot.errorMessage ?? null,
    finished: opts?.finished
  })
}

export async function enqueueTvcGenerateShotlistJob(input: Omit<TvcShotlistJobPayload, "jobId">): Promise<{ jobId: string; snapshot: TvcJobSnapshot }> {
  const jobId = randomUUID()
  const snapshot: TvcJobSnapshot = { jobId, status: "queued", stage: "queued", createdAt: Date.now() }
  const payload: TvcShotlistJobPayload = { ...input, jobId }
  await insertTvcJob({
    jobId,
    userId: input.userId,
    type: TVC_GENERATE_SHOTLIST_JOB_TYPE,
    status: "queued",
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>
  })
  return { jobId, snapshot }
}

function buildStoryText(input: { brief: string; durationSec: number }): string {
  const lines = [
    "你是一个资深广告创意与分镜导演。",
    "请基于以下 Creative Brief 生成一条商业短片（TVC）的结构与镜头设计。",
    "",
    `时长：${input.durationSec} 秒`,
    "",
    "Creative Brief：",
    input.brief.trim()
  ]
  return lines.join("\n")
}

async function runJob(jobId: string, payload: TvcShotlistJobPayload, snapshot: TvcJobSnapshot): Promise<void> {
  const startedAt = Date.now()
  let cur: TvcJobSnapshot = { ...snapshot, jobId, status: "running", stage: "running", startedAt }
  await persist(jobId, cur)

  try {
    cur = { ...cur, stage: "outline" }
    await persist(jobId, cur)

    const storyText = buildStoryText({ brief: payload.brief, durationSec: payload.durationSec })

    const outlineRes = await runGenerateTvcOutline({
      traceId: payload.traceId,
      userId: payload.userId,
      storyId: payload.storyId,
      input_type: "tvc",
      story_text: storyText,
      ratio: payload.ratio,
      resolution: payload.resolution
    })

    cur = {
      ...cur,
      progress: { ...(cur.progress ?? {}), outlineTotal: outlineRes.outlineTotal ?? 0, outlineDone: 0 },
      stage: "storyboard_text"
    }
    await persist(jobId, cur)

    const db = await getDb({ tvcStories, tvcStoryOutlines })
    const [storyRow] = await db
      .select({ userId: tvcStories.userId, title: tvcStories.title })
      .from(tvcStories)
      .where(and(eq(tvcStories.id, payload.storyId), eq(tvcStories.userId, payload.userId)))
      .limit(1)
    if (!storyRow?.userId) throw new Error("STORY_NOT_FOUND")

    const outlines = await db
      .select({ id: tvcStoryOutlines.id, outlineText: tvcStoryOutlines.outlineText, originalText: tvcStoryOutlines.originalText })
      .from(tvcStoryOutlines)
      .where(eq(tvcStoryOutlines.storyId, payload.storyId))
      .orderBy(tvcStoryOutlines.sequence)

    if (outlines.length === 0) throw new Error("OUTLINE_EMPTY")

    for (let i = 0; i < outlines.length; i += 1) {
      const o = outlines[i]
      cur = {
        ...cur,
        progress: {
          ...(cur.progress ?? {}),
          outlineTotal: outlines.length,
          outlineDone: i,
          currentOutlineId: o.id,
          currentOutlineIndex: i + 1
        }
      }
      await persist(jobId, cur)
      await runGenerateTvcStoryboardText({
        traceId: payload.traceId,
        userId: payload.userId,
        outlineId: o.id,
        outline: o.outlineText,
        original: o.originalText
      })
    }

    cur = {
      ...cur,
      progress: { ...(cur.progress ?? {}), outlineTotal: outlines.length, outlineDone: outlines.length },
      status: "done",
      stage: "done",
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      result: { storyId: payload.storyId }
    }
    await persist(jobId, cur, { finished: true })
  } catch (e) {
    const anyErr = e as { message?: unknown; name?: unknown; stack?: unknown }
    const rawMsg = typeof anyErr?.message === "string" ? anyErr.message : "任务执行失败"
    const msg = rawMsg === "COZE_NOT_CONFIGURED" ? "Coze 未配置" : rawMsg === "OUTLINE_EMPTY" ? "大纲为空" : rawMsg
    logger.error({
      event: "tvc_shotlist_job_failed",
      module: "tvc",
      traceId: payload.traceId,
      message: "TVC Shotlist 生成任务失败",
      jobId,
      errorName: typeof anyErr?.name === "string" ? anyErr.name : undefined,
      errorMessage: msg,
      stack: typeof anyErr?.stack === "string" ? anyErr.stack : undefined
    })
    const errSnap: TvcJobSnapshot = { ...cur, status: "error", stage: "error", finishedAt: Date.now(), errorMessage: msg }
    await persist(jobId, errSnap, { errorMessage: msg, finished: true })
  }
}

class TvcShotlistDbWorker {
  private running = false

  kick(): void {
    if (this.running) return
    this.running = true
    void this.runLoop()
  }

  private async runLoop(): Promise<void> {
    try {
      while (true) {
        const claimed = await tryClaimNextTvcJob(TVC_GENERATE_SHOTLIST_JOB_TYPE)
        if (!claimed) break
        const row = await getTvcJobById(claimed.jobId)
        if (!row) continue
        await runJob(claimed.jobId, row.payload as any, row.snapshot as any)
      }
    } finally {
      this.running = false
    }
  }
}

export function kickTvcShotlistWorker(): void {
  const g = globalThis as any
  const existing = g.__tvcShotlistDbWorker as any
  if (existing && typeof existing === "object" && existing.__version !== 1 && existing.running === true) existing.running = false
  if (!existing || existing.__version !== 1) {
    const worker = new TvcShotlistDbWorker() as any
    worker.__version = 1
    g.__tvcShotlistDbWorker = worker
  }
  ;(g.__tvcShotlistDbWorker as TvcShotlistDbWorker).kick()
}
