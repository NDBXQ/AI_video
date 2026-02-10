"use client"

import { useMemo, useState } from "react"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"

export function useTvcAssembleVideo(params: {
  projectId: string | null
  displayShots: TimelineShot[]
  videoClipByOrdinal: Record<number, { url: string; durationSeconds?: number }>
  timelineDraft: { videoClips: any[]; audioClips: any[] } | null
  refreshProject: () => Promise<void>
  setProjectError: (msg: string | null) => void
}): {
  assembleVideo: () => Promise<void>
  isAssemblingVideo: boolean
} {
  const { projectId, displayShots, videoClipByOrdinal, timelineDraft, refreshProject, setProjectError } = params
  const [isAssemblingVideo, setIsAssemblingVideo] = useState(false)

  const assembleVideo = useMemo(() => {
    return async () => {
      if (!projectId) return
      if (isAssemblingVideo) return
      const segById = new Map<string, { url: string; durationSeconds: number }>()
      for (const s of displayShots) {
        const seq = Number(s.sequence ?? 0)
        const fromAssets = Number.isFinite(seq) && seq > 0 ? String(videoClipByOrdinal?.[seq]?.url ?? "").trim() : ""
        const url = fromAssets
        if (!url) continue
        const d = Number(videoClipByOrdinal?.[seq]?.durationSeconds ?? (s.scriptContent as any)?.["时长"] ?? 0)
        const durationSeconds = Number.isFinite(d) && d > 0 ? Math.min(60, Math.max(1, Math.trunc(d))) : 4
        segById.set(s.id, { url, durationSeconds })
      }

      const quantize = (n: number) => Math.round(n * 48) / 48
      const fallbackVideoClips = (() => {
        let t = 0
        const out: Array<{ segmentId: string; start: number; duration: number; trimStart: number; trimEnd: number; src?: string | null }> = []
        const sorted = displayShots.slice().sort((a, b) => (Number(a.sequence ?? 0) || 0) - (Number(b.sequence ?? 0) || 0))
        for (const s of sorted) {
          const seg = segById.get(s.id) ?? null
          if (!seg) continue
          out.push({ segmentId: s.id, start: t, duration: seg.durationSeconds, trimStart: 0, trimEnd: 0, src: seg.url })
          t = quantize(t + seg.durationSeconds)
        }
        return out
      })()

      const timelineVideoClips = Array.isArray(timelineDraft?.videoClips) ? (timelineDraft!.videoClips as any[]) : fallbackVideoClips
      const sortedVideo = timelineVideoClips
        .map((c) => {
          if (!c || typeof c !== "object") return null
          const segmentId = String((c as any).segmentId ?? "").trim()
          if (!segmentId) return null
          const start = Number((c as any).start ?? 0)
          const duration = Number((c as any).duration ?? 0)
          const trimStart = Number((c as any).trimStart ?? 0)
          const trimEnd = Number((c as any).trimEnd ?? 0)
          const src = typeof (c as any).src === "string" ? ((c as any).src as string) : null
          return { segmentId, start, duration, trimStart, trimEnd, src }
        })
        .filter(Boolean)
        .sort((a, b) => ((a as any).start + (a as any).trimStart) - ((b as any).start + (b as any).trimStart)) as Array<{
        segmentId: string
        start: number
        duration: number
        trimStart: number
        trimEnd: number
        src: string | null
      }>

      const mapping: Array<{ inStart: number; inEnd: number; outStart: number }> = []
      let outCursor = 0
      const video_config_list = sortedVideo
        .map((clip) => {
          const seg = segById.get(clip.segmentId) ?? null
          const url = String(seg?.url ?? clip.src ?? "").trim()
          if (!url) return null
          const startTime = quantize(Math.max(0, Number(clip.trimStart ?? 0)))
          const endTime = quantize(Math.max(startTime, Number(clip.duration ?? 0) - Math.max(0, Number(clip.trimEnd ?? 0))))
          const clipDur = quantize(Math.max(0, endTime - startTime))
          if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return null
          const inStart = quantize(Math.max(0, Number(clip.start ?? 0) + startTime))
          const inEnd = quantize(inStart + clipDur)
          const outStart = quantize(outCursor)
          mapping.push({ inStart, inEnd, outStart })
          outCursor = quantize(outCursor + clipDur)
          return { url, start_time: startTime, end_time: endTime }
        })
        .filter(Boolean) as Array<{ url: string; start_time: number; end_time: number }>

      if (video_config_list.length <= 0) {
        setProjectError("没有可用的视频片段，请先生成分镜视频")
        return
      }

      const mapTimeline = (t: number) => {
        const tt = quantize(Math.max(0, t))
        if (mapping.length === 0) return 0
        const last = mapping[mapping.length - 1]!
        if (tt >= last.inEnd) return quantize(last.outStart + (last.inEnd - last.inStart))
        for (const m of mapping) {
          if (tt < m.inStart) return quantize(m.outStart)
          if (tt <= m.inEnd) return quantize(m.outStart + (tt - m.inStart))
        }
        return 0
      }

      const timelineAudioClips = Array.isArray(timelineDraft?.audioClips) ? (timelineDraft!.audioClips as any[]) : []
      const audio_config_list = timelineAudioClips
        .map((clip) => {
          if (!clip || typeof clip !== "object") return null
          const url = String((clip as any).src ?? "").trim()
          if (!url) return null
          const startTime = 0
          const endTime = quantize(Math.max(0, Number((clip as any).duration ?? 0)))
          const timelineStart = mapTimeline(Number((clip as any).start ?? 0))
          if (!Number.isFinite(endTime) || endTime <= 0) return null
          return { url, start_time: startTime, end_time: endTime, timeline_start: timelineStart }
        })
        .filter(Boolean) as Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>

      setProjectError(null)
      setIsAssemblingVideo(true)
      try {
        const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/videos/edit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storyId: projectId, video_config_list, audio_config_list })
        })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        await refreshProject()
      } catch (e) {
        const anyErr = e as { message?: string }
        setProjectError(anyErr?.message ?? "成片合成失败")
      } finally {
        setIsAssemblingVideo(false)
      }
    }
  }, [displayShots, isAssemblingVideo, projectId, refreshProject, setProjectError, timelineDraft, videoClipByOrdinal])

  return { assembleVideo, isAssemblingVideo }
}
