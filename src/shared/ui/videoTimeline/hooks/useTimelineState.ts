import { useEffect, useMemo, useRef, useState } from "react"
import { MIN_CLIP_SECONDS, PX_PER_SECOND, TRACK_OFFSET_PX, TRACK_RIGHT_PADDING_PX, safeDuration, type AudioClip, type TimelineSegment, type VideoClip } from "@/shared/utils/timelineUtils"

interface UseTimelineStateProps {
  segments: TimelineSegment[]
  timelineKey?: string
  initialTimeline?: { videoClips: VideoClip[]; audioClips: AudioClip[] } | null
  onTimelineChange?: (timeline: { videoClips: VideoClip[]; audioClips: AudioClip[] }) => void
}

export function useTimelineState({ segments, timelineKey, initialTimeline, onTimelineChange }: UseTimelineStateProps) {
  const [viewportSeconds, setViewportSeconds] = useState(0)
  const [pxPerSecond, setPxPerSecond] = useState(PX_PER_SECOND)
  const [markers, setMarkers] = useState<number[]>([])

  const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

  const initialVideoClips = useMemo(() => {
    const out: VideoClip[] = []
    let t = 0
    for (const seg of segments) {
      const d = safeDuration(seg)
      const src = typeof seg.videoSrc === "string" && seg.videoSrc.trim() ? seg.videoSrc.trim() : undefined
      out.push({
        id: `v-${seg.id}`,
        segmentId: seg.id,
        title: seg.title,
        ...(src ? { src } : {}),
        start: t,
        duration: d,
        trimStart: 0,
        trimEnd: 0
      })
      t += d
    }
    return out
  }, [segments])

  const [videoClips, setVideoClips] = useState<VideoClip[]>(initialVideoClips)
  const [audioClips, setAudioClips] = useState<AudioClip[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [selectedClips, setSelectedClips] = useState<Array<{ type: "video" | "audio"; id: string }>>([])

  const appliedKeyRef = useRef<string>("")
  const latestVideoClipsRef = useRef<VideoClip[]>(videoClips)
  useEffect(() => {
    latestVideoClipsRef.current = videoClips
  }, [videoClips])

  const durationSyncKeyRef = useRef<string>("")

  useEffect(() => {
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => {
            void Promise.resolve().then(cb)
          }

    const key = timelineKey ?? "default"
    if (appliedKeyRef.current === key) return
    appliedKeyRef.current = key
    if (initialTimeline && Array.isArray(initialTimeline.videoClips) && Array.isArray(initialTimeline.audioClips)) {
      schedule(() => {
        const incoming = initialTimeline.videoClips
        const knownSegmentIds = new Set(initialVideoClips.map((c) => c.segmentId))
        const incomingKnown = incoming.filter((c) => knownSegmentIds.has(c.segmentId))
        const shouldAutoArrange = (() => {
          if (incomingKnown.length !== initialVideoClips.length) return true
          for (const c of incomingKnown) {
            if (!isFiniteNumber(c.start) || c.start < 0) return true
            if (!isFiniteNumber(c.duration) || c.duration <= 0) return true
          }
          const EPS = 1e-3
          const sorted = incomingKnown
            .map((c) => ({
              s: c.start + Math.max(0, c.trimStart),
              e: c.start + c.duration - Math.max(0, c.trimEnd)
            }))
            .sort((a, b) => a.s - b.s)
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].s < sorted[i - 1].e - EPS) return true
          }
          return false
        })()

        if (!shouldAutoArrange) {
          setVideoClips(incoming)
        } else {
          const bySeg = new Map<string, VideoClip>()
          for (const c of incomingKnown) {
            if (!bySeg.has(c.segmentId)) bySeg.set(c.segmentId, c)
          }
          let t = 0
          const arranged = initialVideoClips.map((base) => {
            const inc = bySeg.get(base.segmentId)
            const duration = inc && isFiniteNumber(inc.duration) && inc.duration > 0 ? inc.duration : base.duration
            const trimStart = inc && isFiniteNumber(inc.trimStart) ? Math.max(0, inc.trimStart) : 0
            const trimEnd = inc && isFiniteNumber(inc.trimEnd) ? Math.max(0, inc.trimEnd) : 0
            const src = typeof inc?.src === "string" && inc.src.trim() ? inc.src.trim() : base.src
            const next: VideoClip = {
              ...base,
              ...(inc ?? {}),
              start: t,
              duration,
              trimStart,
              trimEnd,
              ...(src ? { src } : {})
            }
            t += duration
            return next
          })
          setVideoClips(arranged)
        }
        setAudioClips(initialTimeline.audioClips)
        setSelectedClips([])
        setMarkers([])
      })
      return
    }
    schedule(() => {
      setVideoClips(initialVideoClips)
      setAudioClips([])
      setSelectedClips([])
      setMarkers([])
    })
  }, [initialTimeline, initialVideoClips, timelineKey])

  useEffect(() => {
    if (initialTimeline) return
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => {
            void Promise.resolve().then(cb)
          }
    schedule(() => setVideoClips(initialVideoClips))
  }, [initialTimeline, initialVideoClips])

  useEffect(() => {
    const key = timelineKey ?? "default"
    const durationKey = segments
      .map((s) => {
        const raw = Number(s.durationSeconds ?? 0)
        return `${s.id}:${Number.isFinite(raw) && raw > 0 ? raw : ""}`
      })
      .join("|")
    const combinedKey = `${key}::${durationKey}`
    if (durationSyncKeyRef.current === combinedKey) return
    durationSyncKeyRef.current = combinedKey

    if (!segments.length) return
    if (selectedClips.length > 0) return
    if (dragOver) return

    const clips = latestVideoClipsRef.current
    if (clips.length !== segments.length) return

    const segById = new Map<string, TimelineSegment>()
    for (const s of segments) segById.set(s.id, s)

    const clipBySegId = new Map<string, VideoClip>()
    for (const c of clips) {
      if (!c?.segmentId) return
      if (clipBySegId.has(c.segmentId)) return
      if (!segById.has(c.segmentId)) return
      clipBySegId.set(c.segmentId, c)
    }
    if (clipBySegId.size !== segments.length) return

    const EPS = 1e-3
    let t0 = 0
    for (const s of segments) {
      const c = clipBySegId.get(s.id)!
      if (typeof c.start !== "number" || !Number.isFinite(c.start)) return
      if (typeof c.duration !== "number" || !Number.isFinite(c.duration) || c.duration <= 0) return
      if (Math.abs(c.start - t0) > EPS) return
      if (Math.max(0, c.trimStart) > EPS || Math.max(0, c.trimEnd) > EPS) return
      t0 += c.duration
    }

    const desiredDurBySeg = new Map<string, number>()
    for (const s of segments) {
      const raw = Number(s.durationSeconds ?? 0)
      if (Number.isFinite(raw) && raw > 0) desiredDurBySeg.set(s.id, raw)
    }
    if (desiredDurBySeg.size === 0) return

    const hasMismatch = segments.some((s) => {
      const desired = desiredDurBySeg.get(s.id)
      if (!desired) return false
      const cur = clipBySegId.get(s.id)!.duration
      return Math.abs(cur - desired) > 1e-3
    })
    if (!hasMismatch) return

    let t = 0
    const next = segments.map((s) => {
      const cur = clipBySegId.get(s.id)!
      const desired = desiredDurBySeg.get(s.id)
      const duration = desired ?? cur.duration
      const trimStart0 = Math.max(0, cur.trimStart)
      const trimEnd0 = Math.max(0, cur.trimEnd)
      const maxTrimStart = Math.max(0, duration - trimEnd0 - MIN_CLIP_SECONDS)
      const trimStart = Math.min(trimStart0, maxTrimStart)
      const maxTrimEnd = Math.max(0, duration - trimStart - MIN_CLIP_SECONDS)
      const trimEnd = Math.min(trimEnd0, maxTrimEnd)
      const src = typeof s.videoSrc === "string" && s.videoSrc.trim() ? s.videoSrc.trim() : cur.src
      const out: VideoClip = { ...cur, start: t, duration, trimStart, trimEnd, ...(src ? { src } : {}) }
      t += duration
      return out
    })
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => {
            void Promise.resolve().then(cb)
          }
    schedule(() => setVideoClips(next))
  }, [dragOver, segments, selectedClips.length, timelineKey])

  useEffect(() => {
    onTimelineChange?.({ videoClips, audioClips })
  }, [audioClips, onTimelineChange, videoClips])

  const totalSeconds = useMemo(() => {
    const endA = audioClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    const endV = videoClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    const base = Math.max(4, Math.ceil(Math.max(endA, endV)))
    const tailPadding = 2
    return Math.max(base + tailPadding, viewportSeconds)
  }, [audioClips, videoClips, viewportSeconds])

  const widthPx = Math.max(640, TRACK_OFFSET_PX + TRACK_RIGHT_PADDING_PX + Math.round(totalSeconds * pxPerSecond))

  const updateVideoClip = (id: string, patch: Partial<VideoClip>) => {
    setVideoClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const updateVideoClipsBulk = (patches: Array<{ id: string; patch: Partial<VideoClip> }>) => {
    const map = new Map<string, Partial<VideoClip>>()
    for (const p of patches) {
      if (!p?.id) continue
      map.set(p.id, { ...(map.get(p.id) ?? {}), ...(p.patch ?? {}) })
    }
    if (map.size === 0) return
    setVideoClips((prev) => prev.map((c) => (map.has(c.id) ? { ...c, ...(map.get(c.id) ?? {}) } : c)))
  }

  const updateAudioClip = (id: string, patch: Partial<AudioClip>) => {
    setAudioClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  return {
    viewportSeconds,
    setViewportSeconds,
    pxPerSecond,
    setPxPerSecond,
    markers,
    setMarkers,
    videoClips,
    setVideoClips,
    audioClips,
    setAudioClips,
    dragOver,
    setDragOver,
    selectedClips,
    setSelectedClips,
    totalSeconds,
    widthPx,
    updateVideoClip,
    updateVideoClipsBulk,
    updateAudioClip
  }
}
