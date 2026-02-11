"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"

export function useTvcShotlistFlow(params: {
  projectId: string | null
  brief: string
  durationSec: number
  setProjectError: (msg: string | null) => void
  sendTelemetry: (event: string, payload: Record<string, unknown>) => void
}): {
  shots: TimelineShot[]
  setShots: React.Dispatch<React.SetStateAction<TimelineShot[]>>
  shotlistLoading: boolean
  isGeneratingShotlist: boolean
  handleGenerateShotlist: () => void
  refreshShotlist: () => Promise<void>
} {
  const { projectId, brief, durationSec, setProjectError, sendTelemetry } = params
  const [shots, setShots] = useState<TimelineShot[]>([])
  const [shotlistLoading, setShotlistLoading] = useState(false)
  const [isGeneratingShotlist, setIsGeneratingShotlist] = useState(false)
  const refreshTokenRef = useRef(0)

  const refreshShotlist = useCallback(async () => {
    if (!projectId) return
    const token = (refreshTokenRef.current += 1)
    setShotlistLoading(true)
    try {
      const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/shotlist`, { method: "GET", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as any
      if (refreshTokenRef.current !== token) return
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const list = Array.isArray(json.data.shots) ? (json.data.shots as any[]) : []
      if (refreshTokenRef.current !== token) return
      setShots(
        list.map((s) => ({
          id: String(s.id ?? ""),
          sequence: Number(s.sequence ?? 0) || 0,
          storyboardText: String(s.storyboardText ?? ""),
          shotCut: Boolean(s.shotCut),
          scriptContent: s.scriptContent ?? null,
          frames: (s.frames ?? {}) as any,
          videoInfo: (s.videoInfo ?? {}) as any
        }))
      )
    } catch {
      if (refreshTokenRef.current !== token) return
      setShots([])
    } finally {
      if (refreshTokenRef.current !== token) return
      setShotlistLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setShots([])
  }, [projectId])

  useEffect(() => {
    void refreshShotlist()
  }, [refreshShotlist])

  const generateShotlist = useMemo(() => {
    const waitJob = async (jobId: string) => {
      const start = Date.now()
      while (true) {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "GET", cache: "no-store" })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const status = String(json.data.status ?? "")
        if (status === "done" || status === "error") return json.data
        if (Date.now() - start > 10 * 60 * 1000) throw new Error("生成超时")
        await new Promise((r) => setTimeout(r, 1200))
      }
    }

    return async () => {
      if (!projectId) return
      setProjectError(null)
      setIsGeneratingShotlist(true)
      try {
        await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brief, durationSec })
        })
        const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/generate-shotlist`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brief, durationSec })
        })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const jobId = String(json.data.jobId ?? "").trim()
        await waitJob(jobId)
        await refreshShotlist()
      } catch (e) {
        const anyErr = e as { message?: string }
        setProjectError(anyErr?.message ?? "生成失败")
      } finally {
        setIsGeneratingShotlist(false)
      }
    }
  }, [brief, durationSec, projectId, refreshShotlist, setProjectError])

  const handleGenerateShotlist = useCallback(() => {
    sendTelemetry("tvc_generate_shotlist_clicked", { durationSec, hasProject: Boolean(projectId) })
    void generateShotlist()
  }, [durationSec, generateShotlist, projectId, sendTelemetry])

  return { shots, setShots, shotlistLoading, isGeneratingShotlist, handleGenerateShotlist, refreshShotlist }
}
