import { EventEmitter } from "events"

type PromptInput = {
  name: string
  prompt: string
  description?: string
  category: "background" | "role" | "item"
  generatedImageId?: string
}

export type ReferenceImageJobStatus = "queued" | "running" | "done" | "error"

export type ReferenceImageJobSnapshot = {
  jobId: string
  status: ReferenceImageJobStatus
  storyId: string
  storyboardId: string | null
  createdAt: number
  startedAt?: number
  finishedAt?: number
  forceRegenerate: boolean
  results: Array<{
    name: string
    category: string
    ok: boolean
    skipped?: boolean
    id?: string
    url?: string
    thumbnailUrl?: string | null
    errorMessage?: string
  }>
  summary: { total: number; ok: number; skipped: number; failed: number }
  errorMessage?: string
}

export type ReferenceImageJobPayload = {
  jobId: string
  userId: string
  storyId: string
  storyboardId: string | null
  prompts: PromptInput[]
  forceRegenerate: boolean
  traceId: string
}

type JobInternal = {
  payload: ReferenceImageJobPayload
  snapshot: ReferenceImageJobSnapshot
}

type JobEvent = { type: "snapshot"; snapshot: ReferenceImageJobSnapshot }

class ReferenceImageJobManager {
  private jobs = new Map<string, JobInternal>()
  private emitter = new EventEmitter()
  private queue: string[] = []
  private workerRunning = false

  onJobEvent(jobId: string, listener: (evt: JobEvent) => void): () => void {
    const key = `job:${jobId}`
    this.emitter.on(key, listener)
    return () => {
      this.emitter.off(key, listener)
    }
  }

  emitSnapshot(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    this.emitter.emit(`job:${jobId}`, { type: "snapshot", snapshot: job.snapshot } satisfies JobEvent)
  }

  getSnapshot(jobId: string): ReferenceImageJobSnapshot | null {
    return this.jobs.get(jobId)?.snapshot ?? null
  }

  getOwnerUserId(jobId: string): string | null {
    return this.jobs.get(jobId)?.payload.userId ?? null
  }

  createJob(payload: ReferenceImageJobPayload): ReferenceImageJobSnapshot {
    const createdAt = Date.now()
    const results = payload.prompts.map((p) => ({ name: p.name, category: p.category, ok: false as const }))
    const snapshot: ReferenceImageJobSnapshot = {
      jobId: payload.jobId,
      status: "queued",
      storyId: payload.storyId,
      storyboardId: payload.storyboardId,
      createdAt,
      forceRegenerate: payload.forceRegenerate,
      results,
      summary: { total: results.length, ok: 0, skipped: 0, failed: 0 }
    }
    this.jobs.set(payload.jobId, { payload, snapshot })
    this.queue.push(payload.jobId)
    this.emitSnapshot(payload.jobId)
    this.ensureWorker()
    return snapshot
  }

  updateSnapshot(jobId: string, next: Partial<ReferenceImageJobSnapshot>): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    job.snapshot = { ...job.snapshot, ...next }
    this.emitSnapshot(jobId)
  }

  setResultAt(jobId: string, index: number, result: ReferenceImageJobSnapshot["results"][number]): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    const nextResults = job.snapshot.results.slice()
    nextResults[index] = result
    const okCount = nextResults.filter((r) => r.ok).length
    const skippedCount = nextResults.filter((r) => r.ok && r.skipped).length
    const failedCount = nextResults.filter((r) => !r.ok).length
    job.snapshot = {
      ...job.snapshot,
      results: nextResults,
      summary: { total: nextResults.length, ok: okCount, skipped: skippedCount, failed: failedCount }
    }
    this.emitSnapshot(jobId)
  }

  async runJob(jobId: string, runner: (payload: ReferenceImageJobPayload, manager: ReferenceImageJobManager) => Promise<void>): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return
    const startedAt = Date.now()
    this.updateSnapshot(jobId, { status: "running", startedAt })
    try {
      await runner(job.payload, this)
      this.updateSnapshot(jobId, { status: "done", finishedAt: Date.now() })
    } catch (e) {
      const anyErr = e as { message?: unknown }
      const errorMessage = typeof anyErr?.message === "string" ? anyErr.message : "unknown error"
      this.updateSnapshot(jobId, { status: "error", errorMessage, finishedAt: Date.now() })
    }
  }

  private ensureWorker(): void {
    if (this.workerRunning) return
    this.workerRunning = true
    queueMicrotask(async () => {
      try {
        while (this.queue.length > 0) {
          const jobId = this.queue.shift()
          if (!jobId) continue
          const job = this.jobs.get(jobId)
          if (!job) continue
          const runner = (globalThis as any).__referenceImageJobRunner as
            | ((payload: ReferenceImageJobPayload, manager: ReferenceImageJobManager) => Promise<void>)
            | undefined
          if (!runner) {
            this.updateSnapshot(jobId, { status: "error", errorMessage: "job runner not initialized", finishedAt: Date.now() })
            continue
          }
          await this.runJob(jobId, runner)
        }
      } finally {
        this.workerRunning = false
      }
    })
  }
}

export function getReferenceImageJobManager(): ReferenceImageJobManager {
  const g = globalThis as any
  if (!g.__referenceImageJobManager) g.__referenceImageJobManager = new ReferenceImageJobManager()
  return g.__referenceImageJobManager as ReferenceImageJobManager
}

export function registerReferenceImageJobRunner(
  runner: (payload: ReferenceImageJobPayload, manager: ReferenceImageJobManager) => Promise<void>
): void {
  ;(globalThis as any).__referenceImageJobRunner = runner
}
