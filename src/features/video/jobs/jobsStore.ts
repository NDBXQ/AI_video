"use client"

import type { ActiveJob, JobsSummary } from "@/features/video/types/jobs"

type JobsState = {
  jobs: ActiveJob[]
  summary: JobsSummary
  loading: boolean
  error: string | null
}

type JobsListener = (state: JobsState) => void

type JobsSnapshotMessage = {
  ok: true
  data: { kind: "jobs_snapshot"; storyId: string; jobs: ActiveJob[]; summary: JobsSummary }
  traceId: string
}

type JobsErrMessage = {
  ok: false
  error: { code: string; message: string }
  traceId: string
}

const defaultSummary: JobsSummary = { queued: 0, running: 0, total: 0 }

function computeSummary(list: ActiveJob[]): JobsSummary {
  const queued = list.filter((j) => j.status === "queued").length
  const running = list.filter((j) => j.status === "running").length
  return { queued, running, total: list.length }
}

function computeSignature(list: ActiveJob[]): string {
  if (!Array.isArray(list) || list.length === 0) return ""
  const sorted = [...list].sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)))
  return sorted
    .map((j) => {
      const stage = typeof (j.snapshot as any)?.stage === "string" ? String((j.snapshot as any).stage) : ""
      return `${j.jobId}:${j.status}:${j.progressVersion}:${stage}`
    })
    .join("|")
}

class StoryJobsConnection {
  private storyId: string
  private listeners = new Set<JobsListener>()
  private state: JobsState = { jobs: [], summary: defaultSummary, loading: true, error: null }
  private lastSignature = ""
  private eventSource: EventSource | null = null
  private pollTimer: number | null = null
  private sseFailed = false
  private intervalMs: number

  constructor(storyId: string, intervalMs: number) {
    this.storyId = storyId
    this.intervalMs = intervalMs
  }

  getSnapshot(): JobsState {
    return this.state
  }

  subscribe(listener: JobsListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    this.ensureConnected()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.dispose()
    }
  }

  async refresh(): Promise<void> {
    const sid = this.storyId
    if (!sid) return
    this.setState({ ...this.state, loading: true, error: null })
    try {
      const qs = new URLSearchParams({ storyId: sid, activeOnly: "true", limit: "20" })
      const res = await fetch(`/api/jobs?${qs.toString()}`, { method: "GET", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { ok: true; data: { jobs: ActiveJob[] }; traceId: string } | JobsErrMessage | null
      if (!res.ok || !json || (json as JobsErrMessage).ok === false) {
        const errJson = (json as JobsErrMessage | null) ?? null
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
      }
      const nextJobs = Array.isArray((json as any).data?.jobs) ? ((json as any).data?.jobs as ActiveJob[]) : []
      this.applyJobs(nextJobs)
    } catch (e) {
      const anyErr = e as { message?: string }
      this.setState({ ...this.state, loading: false, error: anyErr?.message ?? "加载任务失败" })
    } finally {
      this.setState({ ...this.state, loading: false })
    }
  }

  ensureConnected(): void {
    if (!this.storyId || this.listeners.size === 0) return
    if (typeof document !== "undefined" && document.hidden) return
    if (this.eventSource || this.pollTimer) return
    if (this.sseFailed || typeof EventSource === "undefined") {
      this.startPolling()
      return
    }
    this.startSse()
  }

  onVisibilityChange(): void {
    if (typeof document === "undefined") return
    if (document.hidden) {
      this.stopSse()
      this.stopPolling()
      return
    }
    this.ensureConnected()
  }

  private applyJobs(nextJobs: ActiveJob[]): void {
    const sig = computeSignature(nextJobs)
    if (sig === this.lastSignature) return
    this.lastSignature = sig
    this.setState({ jobs: nextJobs, summary: computeSummary(nextJobs), loading: false, error: null })
  }

  private startSse(): void {
    const qs = new URLSearchParams({ storyId: this.storyId, activeOnly: "true", limit: "20" })
    const es = new EventSource(`/api/jobs/events?${qs.toString()}`)
    this.eventSource = es
    this.setState({ ...this.state, loading: true, error: null })

    es.onmessage = (ev) => {
      const parsed = (() => {
        try {
          return JSON.parse(ev.data) as JobsSnapshotMessage | JobsErrMessage
        } catch {
          return null
        }
      })()
      if (!parsed) return
      if ((parsed as any).ok === false) {
        this.setState({ ...this.state, loading: false, error: (parsed as JobsErrMessage).error?.message ?? "订阅任务失败" })
        return
      }
      const msg = parsed as JobsSnapshotMessage
      if (msg.data?.kind !== "jobs_snapshot") return
      const jobs = Array.isArray(msg.data.jobs) ? msg.data.jobs : []
      this.applyJobs(jobs)
    }

    es.onerror = () => {
      this.stopSse()
      this.sseFailed = true
      void this.refresh().finally(() => this.startPolling())
    }
  }

  private stopSse(): void {
    if (!this.eventSource) return
    try {
      this.eventSource.close()
    } catch {}
    this.eventSource = null
  }

  private startPolling(): void {
    if (this.pollTimer) return
    const interval = Math.max(800, Math.floor(this.intervalMs))
    void this.refresh()
    this.pollTimer = window.setInterval(() => {
      void this.refresh()
    }, interval)
  }

  private stopPolling(): void {
    if (!this.pollTimer) return
    window.clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private setState(next: JobsState): void {
    this.state = next
    this.listeners.forEach((l) => l(this.state))
  }

  private dispose(): void {
    this.stopSse()
    this.stopPolling()
  }
}

const connections = new Map<string, StoryJobsConnection>()
let visibilityBound = false

function bindVisibility(): void {
  if (visibilityBound) return
  visibilityBound = true
  if (typeof document === "undefined") return
  document.addEventListener("visibilitychange", () => {
    connections.forEach((c) => c.onVisibilityChange())
  })
}

export function subscribeStoryJobs(params: { storyId: string; intervalMs?: number }, listener: JobsListener): () => void {
  bindVisibility()
  const storyId = params.storyId.trim()
  const intervalMs = Math.max(1200, Math.floor(params.intervalMs ?? 5000))
  if (!storyId) {
    listener({ jobs: [], summary: defaultSummary, loading: false, error: null })
    return () => {}
  }
  let conn = connections.get(storyId)
  if (!conn) {
    conn = new StoryJobsConnection(storyId, intervalMs)
    connections.set(storyId, conn)
  }
  return conn.subscribe(listener)
}

export function getStoryJobsSnapshot(storyId: string): JobsState {
  const conn = connections.get(storyId.trim())
  return conn?.getSnapshot() ?? { jobs: [], summary: defaultSummary, loading: false, error: null }
}

export async function refreshStoryJobs(storyId: string): Promise<void> {
  const conn = connections.get(storyId.trim())
  await conn?.refresh()
}
