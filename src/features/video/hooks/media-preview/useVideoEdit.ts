import { useCallback, useMemo, useState } from "react"
import type { TimelineAudioClip, TimelineSegment } from "@/shared/utils/mediaPreviewUtils"

export function useVideoEdit(params: {
  enabled: boolean
  storyId?: string
  segments: TimelineSegment[]
  timelineVideoClips: Array<{
    segmentId: string
    title?: string
    start: number
    duration: number
    trimStart: number
    trimEnd: number
    src?: string | null
  }>
  timelineAudioClips: TimelineAudioClip[]
  stopPreviewAll: () => void
}) {
  const { enabled, storyId, segments, timelineVideoClips, timelineAudioClips, stopPreviewAll } = params
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)

  const buildEditPayload = useCallback(() => {
    const segById = new Map<string, TimelineSegment>()
    for (const s of segments) segById.set(s.id, s)
    const quantize = (n: number) => Math.round(n * 48) / 48

    const sortedVideo = [...timelineVideoClips].sort((a, b) => (a.start + a.trimStart) - (b.start + b.trimStart))
    const mapping: Array<{ inStart: number; inEnd: number; outStart: number }> = []
    let outCursor = 0
    const video_config_list = sortedVideo
      .map((clip) => {
        const seg = segById.get(clip.segmentId) ?? null
        const url = ((seg?.videoSrc ?? clip.src ?? "") as string).trim()
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

    const audio_config_list = timelineAudioClips
      .map((clip) => {
        const url = (clip.src ?? "").trim()
        if (!url) return null
        const startTime = 0
        const endTime = quantize(Math.max(0, Number(clip.duration ?? 0)))
        const timelineStart = mapTimeline(Number(clip.start ?? 0))
        if (!Number.isFinite(endTime) || endTime <= 0) return null
        return { url, start_time: startTime, end_time: endTime, timeline_start: timelineStart }
      })
      .filter(Boolean) as Array<{ url: string; start_time: number; end_time: number; timeline_start: number }>

    return { storyId: storyId ?? "", video_config_list, audio_config_list }
  }, [segments, storyId, timelineAudioClips, timelineVideoClips])

  const handleEdit = useCallback(async () => {
    if (!enabled) return
    if (!storyId?.trim()) {
      alert("缺少 storyId，无法生成成片")
      return
    }
    if (editingLoading) return
    setEditingLoading(true)
    try {
      const payload = buildEditPayload()
      stopPreviewAll()
      const res = await fetch("/api/video-creation/videos/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { output_video_url?: string; final_video_url?: string }; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const url = (json.data?.output_video_url ?? json.data?.final_video_url ?? "").trim()
      if (!url) throw new Error("剪辑接口返回缺少 output_video_url")
      setEditedVideoUrl(url)
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "生成成片失败"
      alert(msg)
    } finally {
      setEditingLoading(false)
    }
  }, [buildEditPayload, editingLoading, enabled, stopPreviewAll])

  const downloadEditedVideo = useCallback(() => {
    const url = (editedVideoUrl ?? "").trim()
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.target = "_blank"
    a.rel = "noreferrer"
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [editedVideoUrl])

  return { editedVideoUrl, editingLoading, handleEdit, downloadEditedVideo }
}
