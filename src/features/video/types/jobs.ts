export type JobStatus = "queued" | "running" | "done" | "error"

export type ActiveJob = {
  jobId: string
  type: string
  status: JobStatus
  progressVersion: number
  snapshot: Record<string, unknown>
}

export type JobsSummary = { queued: number; running: number; total: number }
