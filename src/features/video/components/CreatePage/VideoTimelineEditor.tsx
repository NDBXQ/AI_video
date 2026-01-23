import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./VideoTimelineEditor.module.css"
import { TimelineTrack } from "../VideoTimeline/TimelineTrack"
import {
  type TimelineSegment,
  type VideoClip,
  type AudioClip,
  PX_PER_SECOND,
  MIN_CLIP_SECONDS,
  TRACK_OFFSET_PX,
  TRACK_RIGHT_PADDING_PX,
  clamp,
  safeDuration,
  parseAsset,
  clipLeftPx,
  clipWidthPx
} from "../../utils/timelineUtils"

export function VideoTimelineEditor({
  segments,
  activeId,
  onSelectSegment,
  timelineKey,
  initialTimeline,
  onTimelineChange,
  playheadSeconds,
  playheadActive
}: {
  segments: TimelineSegment[]
  activeId: string
  onSelectSegment: (id: string) => void
  timelineKey?: string
  initialTimeline?: { videoClips: VideoClip[]; audioClips: AudioClip[] } | null
  onTimelineChange?: (timeline: { videoClips: VideoClip[]; audioClips: AudioClip[] }) => void
  playheadSeconds?: number | null
  playheadActive?: boolean
}): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [viewportSeconds, setViewportSeconds] = useState(0)

  const initialVideoClips = useMemo(() => {
    const out: VideoClip[] = []
    let t = 0
    for (const seg of segments) {
      const d = safeDuration(seg)
      out.push({
        id: `v-${seg.id}`,
        segmentId: seg.id,
        title: seg.title,
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

  const appliedKeyRef = useRef<string>("")
  useEffect(() => {
    const key = timelineKey ?? "default"
    if (appliedKeyRef.current === key) return
    appliedKeyRef.current = key
    if (initialTimeline && Array.isArray(initialTimeline.videoClips) && Array.isArray(initialTimeline.audioClips)) {
      setVideoClips(initialTimeline.videoClips)
      setAudioClips(initialTimeline.audioClips)
      return
    }
    setVideoClips(initialVideoClips)
    setAudioClips([])
  }, [initialTimeline, initialVideoClips, timelineKey])

  useEffect(() => {
    if (initialTimeline) return
    setVideoClips(initialVideoClips)
  }, [initialTimeline, initialVideoClips])

  useEffect(() => {
    onTimelineChange?.({ videoClips, audioClips })
  }, [audioClips, onTimelineChange, videoClips])

  const totalSeconds = useMemo(() => {
    const endA = audioClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    const endV = videoClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
    const byContent = Math.max(4, Math.ceil(Math.max(endA, endV)))
    return Math.max(byContent, viewportSeconds)
  }, [audioClips, videoClips, viewportSeconds])

  const widthPx = Math.max(640, TRACK_OFFSET_PX + TRACK_RIGHT_PADDING_PX + Math.round(totalSeconds * PX_PER_SECOND))

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const calc = () => {
      const w = el.clientWidth
      const next = w > 0 ? Math.max(4, Math.ceil(w / PX_PER_SECOND)) : 0
      setViewportSeconds(next)
    }
    calc()
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => calc())
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const asset = parseAsset(e.dataTransfer)
    setDragOver(false)
    if (!asset) return
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const t = clamp((e.clientX - rect.left - TRACK_OFFSET_PX) / PX_PER_SECOND, 0, totalSeconds)
    if (asset.kind === "audio") {
      const id = `a-${asset.id}-${Date.now()}`
      setAudioClips((prev) => [...prev, { id, assetId: asset.id, name: asset.name, start: t, duration: 3, src: asset.src }])
    }
    if (asset.kind === "video") {
      const seg = segments.find((s) => s.id === asset.id)
      const duration = seg ? safeDuration(seg) : typeof asset.durationSeconds === "number" && asset.durationSeconds > 0 ? asset.durationSeconds : 2
      const id = `v-${asset.id}-${Date.now()}`
      setVideoClips((prev) => [
        ...prev,
        { id, segmentId: asset.id, title: asset.name, start: t, duration, trimStart: 0, trimEnd: 0 }
      ])
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragOver) setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  const scrollToActive = useCallback(() => {
    const el = wrapRef.current
    const clip = videoClips.find((c) => c.segmentId === activeId)
    if (!el || !clip) return
    const target = Math.max(0, TRACK_OFFSET_PX + Math.round(clip.start * PX_PER_SECOND) - 120)
    el.scrollTo({ left: target, behavior: "smooth" })
  }, [activeId, videoClips])

  useEffect(() => {
    scrollToActive()
  }, [scrollToActive])

  const playheadPx = useMemo(() => {
    if (!playheadActive) return null
    const s = Number(playheadSeconds ?? 0)
    if (!Number.isFinite(s) || s < 0) return null
    return TRACK_OFFSET_PX + s * PX_PER_SECOND
  }, [playheadActive, playheadSeconds])

  const playheadScrollRef = useRef<{ t: number; x: number }>({ t: 0, x: -1 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    if (!playheadActive) return
    if (playheadPx === null) return
    const now = performance.now()
    if (now - playheadScrollRef.current.t < 90 && Math.abs(playheadPx - playheadScrollRef.current.x) < 12) return
    playheadScrollRef.current = { t: now, x: playheadPx }
    const left = el.scrollLeft
    const right = left + el.clientWidth
    const padding = 120
    if (playheadPx < left + padding || playheadPx > right - padding) {
      const target = Math.max(0, Math.round(playheadPx - el.clientWidth / 2))
      el.scrollTo({ left: target, behavior: "auto" })
    }
  }, [playheadActive, playheadPx])

  const updateVideoClip = (id: string, patch: Partial<VideoClip>) => {
    setVideoClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const updateAudioClip = (id: string, patch: Partial<AudioClip>) => {
    setAudioClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const renderTimeRuler = () => {
    const ticks = []
    for (let s = 0; s <= totalSeconds; s += 1) {
      ticks.push(
        <div key={s} className={styles.tick} style={{ left: s * PX_PER_SECOND }}>
          <div className={styles.tickLine} />
          {s % 2 === 0 ? <div className={styles.tickLabel}>{s}s</div> : null}
        </div>
      )
    }
    return <div className={styles.ruler}>{ticks}</div>
  }

  const makeTrimHandler = (clip: VideoClip, edge: "start" | "end") => {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const initialTrimStart = clip.trimStart
      const initialTrimEnd = clip.trimEnd
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / PX_PER_SECOND
        if (edge === "start") {
          const next = clamp(initialTrimStart + dx, 0, clip.duration - initialTrimEnd - MIN_CLIP_SECONDS)
          updateVideoClip(clip.id, { trimStart: next, start: Math.max(clip.start, -next) })
        } else {
          const next = clamp(initialTrimEnd - dx, 0, clip.duration - initialTrimStart - MIN_CLIP_SECONDS)
          updateVideoClip(clip.id, { trimEnd: next })
        }
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    }
  }

  const makeDragHandler = (clip: VideoClip) => {
    return (e: React.PointerEvent) => {
      if ((e.target as HTMLElement)?.dataset?.handle) return
      e.preventDefault()
      const startX = e.clientX
      const initialStart = clip.start
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / PX_PER_SECOND
        const minStart = -clip.trimStart
        const maxStart = Math.max(minStart, totalSeconds - clip.duration + clip.trimEnd)
        const next = clamp(initialStart + dx, minStart, maxStart)
        updateVideoClip(clip.id, { start: next })
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    }
  }

  const makeAudioDragHandler = (clip: AudioClip) => {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const initialStart = clip.start
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / PX_PER_SECOND
        const next = clamp(initialStart + dx, 0, Math.max(0, totalSeconds - clip.duration))
        updateAudioClip(clip.id, { start: next })
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    }
  }

  return (
    <div className={styles.editor}>
      <div
        className={`${styles.timelineWrap} ${dragOver ? styles.timelineWrapDragOver : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className={styles.timelineScroll} ref={wrapRef}>
          <div className={styles.timeline} ref={timelineRef} style={{ width: widthPx }}>
            {renderTimeRuler()}
            {playheadPx !== null ? <div className={styles.playhead} style={{ left: Math.round(playheadPx) }} aria-hidden /> : null}
            
            <TimelineTrack label="视频">
              {videoClips.map((clip) => {
                const active = clip.segmentId === activeId
                const left = clipLeftPx(clip.start + clip.trimStart)
                const width = clipWidthPx(clip.duration - clip.trimStart - clip.trimEnd)
                return (
                  <div
                    key={clip.id}
                    className={`${styles.clip} ${active ? styles.clipActive : ""}`}
                    style={{ left, width }}
                    onPointerDown={makeDragHandler(clip)}
                    onClick={() => onSelectSegment(clip.segmentId)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.clipTitle}>{clip.title}</div>
                    <div data-handle="start" className={styles.clipHandleLeft} onPointerDown={makeTrimHandler(clip, "start")} />
                    <div data-handle="end" className={styles.clipHandleRight} onPointerDown={makeTrimHandler(clip, "end")} />
                  </div>
                )
              })}
            </TimelineTrack>

            <TimelineTrack label="音轨">
              {audioClips.map((clip) => {
                const left = clipLeftPx(clip.start)
                const width = clipWidthPx(clip.duration)
                return (
                  <div
                    key={clip.id}
                    className={styles.audioClip}
                    style={{ left, width }}
                    onPointerDown={makeAudioDragHandler(clip)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.clipTitle}>{clip.name}</div>
                  </div>
                )
              })}
            </TimelineTrack>
          </div>
        </div>
        <div className={styles.dropHint}>拖拽右侧素材到轨道以添加</div>
      </div>
    </div>
  )
}
