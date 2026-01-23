import { randomUUID } from "crypto"
import { logger } from "@/shared/logger"
import { insertJob, tryClaimNextJob, updateJob, getJobById, type JobStatus } from "@/server/jobs/jobDb"
import { runGenerateOutline, runGenerateScript, runGenerateStoryboardText } from "@/server/coze/storyboardTasks"

export const COZE_GENERATE_SCRIPT_JOB_TYPE = "coze_generate_script"
export const COZE_GENERATE_OUTLINE_JOB_TYPE = "coze_generate_outline"
export const COZE_GENERATE_STORYBOARD_TEXT_JOB_TYPE = "coze_generate_storyboard_text"

type CozeScriptJobPayload = {
  jobId: string
  userId: string
  traceId: string
  raw_script: string
  demand: string
  storyboardId?: string
}

type CozeOutlineJobPayload = {
  jobId: string
  userId: string
  traceId: string
  storyId?: string
  input_type: string
  story_text: string
  title?: string
  ratio?: string
  resolution?: string
  style?: string
}

type CozeStoryboardTextJobPayload = {
  jobId: string
  userId: string
  traceId: string
  outlineId: string
  outline: string
  original: string
}

type CozeJobSnapshot = {
  jobId: string
  status: JobStatus
  stage: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  result?: unknown
  errorMessage?: string
  durationMs?: number
}

async function persist(jobId: string, snapshot: CozeJobSnapshot, opts?: { errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await updateJob(jobId, {
    status: snapshot.status,
    snapshot: snapshot as unknown as Record<string, unknown>,
    errorMessage: opts?.errorMessage ?? snapshot.errorMessage ?? null,
    finished: opts?.finished
  })
}

export async function enqueueCozeGenerateScriptJob(input: Omit<CozeScriptJobPayload, "jobId">): Promise<{ jobId: string; snapshot: CozeJobSnapshot }> {
  const jobId = randomUUID()
  const snapshot: CozeJobSnapshot = { jobId, status: "queued", stage: "queued", createdAt: Date.now() }
  const payload: CozeScriptJobPayload = { ...input, jobId }
  await insertJob({
    jobId,
    userId: input.userId,
    type: COZE_GENERATE_SCRIPT_JOB_TYPE,
    status: "queued",
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>
  })
  return { jobId, snapshot }
}

export async function enqueueCozeGenerateOutlineJob(input: Omit<CozeOutlineJobPayload, "jobId">): Promise<{ jobId: string; snapshot: CozeJobSnapshot }> {
  const jobId = randomUUID()
  const snapshot: CozeJobSnapshot = { jobId, status: "queued", stage: "queued", createdAt: Date.now() }
  const payload: CozeOutlineJobPayload = { ...input, jobId }
  await insertJob({
    jobId,
    userId: input.userId,
    type: COZE_GENERATE_OUTLINE_JOB_TYPE,
    status: "queued",
    storyId: input.storyId ?? null,
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>
  })
  return { jobId, snapshot }
}

export async function enqueueCozeGenerateStoryboardTextJob(
  input: Omit<CozeStoryboardTextJobPayload, "jobId">
): Promise<{ jobId: string; snapshot: CozeJobSnapshot }> {
  const jobId = randomUUID()
  const snapshot: CozeJobSnapshot = { jobId, status: "queued", stage: "queued", createdAt: Date.now() }
  const payload: CozeStoryboardTextJobPayload = { ...input, jobId }
  await insertJob({
    jobId,
    userId: input.userId,
    type: COZE_GENERATE_STORYBOARD_TEXT_JOB_TYPE,
    status: "queued",
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>
  })
  return { jobId, snapshot }
}

async function runJob(type: string, jobId: string, payload: Record<string, unknown>, snapshot: Record<string, unknown>): Promise<void> {
  const startedAt = Date.now()
  let cur: CozeJobSnapshot = {
    ...(snapshot as unknown as CozeJobSnapshot),
    jobId,
    status: "running",
    stage: "running",
    startedAt
  }
  await persist(jobId, cur)

  try {
    if (type === COZE_GENERATE_SCRIPT_JOB_TYPE) {
      cur = { ...cur, stage: "coze" }
      await persist(jobId, cur)
      const p = payload as unknown as CozeScriptJobPayload
      const { coze, durationMs } = await runGenerateScript({
        traceId: p.traceId,
        raw_script: p.raw_script,
        demand: p.demand,
        storyboardId: p.storyboardId
      })
      const done: CozeJobSnapshot = { ...cur, status: "done", stage: "done", finishedAt: Date.now(), result: coze, durationMs }
      await persist(jobId, done, { finished: true })
      return
    }

    if (type === COZE_GENERATE_OUTLINE_JOB_TYPE) {
      cur = { ...cur, stage: "coze" }
      await persist(jobId, cur)
      const p = payload as unknown as CozeOutlineJobPayload
      const result = await runGenerateOutline({
        traceId: p.traceId,
        userId: p.userId,
        storyId: p.storyId,
        input_type: p.input_type,
        story_text: p.story_text,
        title: p.title,
        ratio: p.ratio,
        resolution: p.resolution,
        style: p.style
      })
      const done: CozeJobSnapshot = {
        ...cur,
        status: "done",
        stage: "done",
        finishedAt: Date.now(),
        durationMs: result.durationMs,
        result: { storyId: result.storyId, coze: result.coze }
      }
      await persist(jobId, done, { finished: true })
      return
    }

    if (type === COZE_GENERATE_STORYBOARD_TEXT_JOB_TYPE) {
      cur = { ...cur, stage: "coze" }
      await persist(jobId, cur)
      const p = payload as unknown as CozeStoryboardTextJobPayload
      const result = await runGenerateStoryboardText({
        traceId: p.traceId,
        userId: p.userId,
        outlineId: p.outlineId,
        outline: p.outline,
        original: p.original
      })
      const done: CozeJobSnapshot = {
        ...cur,
        status: "done",
        stage: "done",
        finishedAt: Date.now(),
        durationMs: result.durationMs,
        result: result.coze
      }
      await persist(jobId, done, { finished: true })
      return
    }

    const msg = "不支持的任务类型"
    const errSnap: CozeJobSnapshot = { ...cur, status: "error", stage: "error", finishedAt: Date.now(), errorMessage: msg }
    await persist(jobId, errSnap, { errorMessage: msg, finished: true })
  } catch (e) {
    const anyErr = e as { message?: unknown; name?: unknown; stack?: unknown }
    const rawMsg = typeof anyErr?.message === "string" ? anyErr.message : "任务执行失败"
    const msg =
      rawMsg === "COZE_NOT_CONFIGURED"
        ? "Coze 未配置"
        : rawMsg === "STORY_NOT_FOUND"
          ? "Story 不存在"
          : rawMsg === "OUTLINE_NOT_FOUND"
            ? "大纲章节不存在"
            : rawMsg === "FORBIDDEN"
              ? "无权限"
              : rawMsg
    logger.error({
      event: "coze_storyboard_job_failed",
      module: "coze",
      traceId: "server",
      message: "Coze 故事生成任务失败",
      jobId,
      type,
      errorName: typeof anyErr?.name === "string" ? anyErr.name : undefined,
      errorMessage: msg,
      stack: typeof anyErr?.stack === "string" ? anyErr.stack : undefined
    })
    const errSnap: CozeJobSnapshot = { ...cur, status: "error", stage: "error", finishedAt: Date.now(), errorMessage: msg }
    await persist(jobId, errSnap, { errorMessage: msg, finished: true })
  }
}

class CozeStoryboardDbWorker {
  private running = false

  kick(): void {
    if (this.running) return
    this.running = true
    void this.runLoop()
  }

  private async runLoop(): Promise<void> {
    try {
      while (true) {
        const types = [COZE_GENERATE_OUTLINE_JOB_TYPE, COZE_GENERATE_STORYBOARD_TEXT_JOB_TYPE, COZE_GENERATE_SCRIPT_JOB_TYPE] as const
        let claimed: { jobId: string; payload: Record<string, unknown>; snapshot: Record<string, unknown> } | null = null
        let claimedType: string | null = null

        for (const t of types) {
          const got = await tryClaimNextJob(t)
          if (got) {
            claimed = got
            claimedType = t
            break
          }
        }

        if (!claimed || !claimedType) break
        const row = await getJobById(claimed.jobId)
        if (!row) continue
        await runJob(claimedType, claimed.jobId, row.payload, row.snapshot)
      }
    } finally {
      this.running = false
    }
  }
}

export function kickCozeStoryboardWorker(): void {
  const g = globalThis as any
  const existing = g.__cozeStoryboardDbWorker as any
  if (existing && typeof existing === "object" && existing.__version !== 1 && existing.running === true) existing.running = false
  if (!existing || existing.__version !== 1) {
    const worker = new CozeStoryboardDbWorker() as any
    worker.__version = 1
    g.__cozeStoryboardDbWorker = worker
  }
  ;(g.__cozeStoryboardDbWorker as CozeStoryboardDbWorker).kick()
}
