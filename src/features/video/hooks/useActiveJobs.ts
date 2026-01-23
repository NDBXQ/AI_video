"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type JobStatus = "queued" | "running" | "done" | "error"
export type ActiveJob = { jobId: string; type: string; status: JobStatus; progressVersion: number; snapshot: Record<string, unknown> }

type ApiOk<T> = { ok: true; data: T; traceId: string }
type ApiErr = { ok: false; error: { code: string; message: string }; traceId: string }

export function useActiveJobs(params: { storyId?: string; enabled?: boolean; intervalMs?: number }) {
  const storyId = params.storyId?.trim() ?? ""
  const enabled = params.enabled ?? true
  const intervalMs = Math.max(400, Math.floor(params.intervalMs ?? 1200))

  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)
  const aliveRef = useRef(true)
  const lastSignatureRef = useRef<string>("")

  const computeSignature = (list: ActiveJob[]): string => {
    if (!Array.isArray(list) || list.length === 0) return ""
    const sorted = [...list].sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)))
    return sorted
      .map((j) => {
        const stage = typeof (j.snapshot as any)?.stage === "string" ? String((j.snapshot as any).stage) : ""
        return `${j.jobId}:${j.status}:${j.progressVersion}:${stage}`
      })
      .join("|")
  }

  const fetchOnce = useCallback(async () => {
    if (!enabled || !storyId) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ storyId, activeOnly: "true", limit: "20" })
      const res = await fetch(`/api/jobs?${qs.toString()}`, { method: "GET", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as ApiOk<{ jobs: ActiveJob[] }> | ApiErr | null
      if (!res.ok || !json || (json as ApiErr).ok === false) {
        const errJson = (json as ApiErr | null) ?? null
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
      }
      const okJson = json as ApiOk<{ jobs: ActiveJob[] }>
      if (!aliveRef.current) return
      const nextJobs = Array.isArray(okJson.data.jobs) ? okJson.data.jobs : []
      const sig = computeSignature(nextJobs)
      if (sig !== lastSignatureRef.current) {
        lastSignatureRef.current = sig
        setJobs(nextJobs)
      }
    } catch (e) {
      if (!aliveRef.current) return
      const anyErr = e as { message?: string }
      setError(anyErr?.message ?? "加载任务失败")
    } finally {
      if (!aliveRef.current) return
      setLoading(false)
    }
  }, [enabled, storyId])

  useEffect(() => {
    aliveRef.current = true
    if (!enabled || !storyId) {
      setJobs([])
      setError(null)
      setLoading(false)
      return () => {
        aliveRef.current = false
      }
    }

    void fetchOnce()
    timerRef.current = window.setInterval(() => {
      void fetchOnce()
    }, intervalMs)

    return () => {
      aliveRef.current = false
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [enabled, fetchOnce, intervalMs, storyId])

  const summary = useMemo(() => {
    const queued = jobs.filter((j) => j.status === "queued").length
    const running = jobs.filter((j) => j.status === "running").length
    return { queued, running, total: jobs.length }
  }, [jobs])

  return { jobs, summary, loading, error, refresh: fetchOnce }
}
