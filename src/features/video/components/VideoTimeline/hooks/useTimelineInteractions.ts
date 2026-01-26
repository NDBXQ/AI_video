import { useCallback, useEffect, useRef, type RefObject } from "react"
import {
  type VideoClip,
  type AudioClip,
  type TimelineSegment,
  PX_PER_SECOND,
  MIN_CLIP_SECONDS,
  TRACK_OFFSET_PX,
  clamp,
  safeDuration,
  parseAsset
} from "../../../utils/timelineUtils"

interface UseTimelineInteractionsProps {
  segments: TimelineSegment[]
  videoClips: VideoClip[]
  setVideoClips: React.Dispatch<React.SetStateAction<VideoClip[]>>
  audioClips: AudioClip[]
  setAudioClips: React.Dispatch<React.SetStateAction<AudioClip[]>>
  selectedClip: { type: "video" | "audio"; id: string } | null
  setSelectedClip: React.Dispatch<React.SetStateAction<{ type: "video" | "audio"; id: string } | null>>
  dragOver: boolean
  setDragOver: (over: boolean) => void
  totalSeconds: number
  updateVideoClip: (id: string, patch: Partial<VideoClip>) => void
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void
  timelineRef: RefObject<HTMLDivElement>
  wrapRef: RefObject<HTMLDivElement>
  keyboardScopeRef: RefObject<HTMLDivElement>
  playheadActive?: boolean
  playheadSeconds?: number | null
  onSeekPlayheadSeconds?: (seconds: number) => void
  activeId: string
  onSelectSegment: (id: string) => void
}

export function useTimelineInteractions({
  segments,
  videoClips,
  setVideoClips,
  audioClips,
  setAudioClips,
  selectedClip,
  setSelectedClip,
  dragOver,
  setDragOver,
  totalSeconds,
  updateVideoClip,
  updateAudioClip,
  timelineRef,
  wrapRef,
  keyboardScopeRef,
  playheadActive,
  playheadSeconds,
  onSeekPlayheadSeconds,
  activeId,
  onSelectSegment
}: UseTimelineInteractionsProps) {

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
  }, [activeId, videoClips, wrapRef])

  useEffect(() => {
    scrollToActive()
  }, [scrollToActive])

  const playheadPx = (() => {
    if (!playheadActive) return null
    const s = Number(playheadSeconds ?? 0)
    if (!Number.isFinite(s) || s < 0) return null
    return TRACK_OFFSET_PX + s * PX_PER_SECOND
  })()

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
  }, [playheadActive, playheadPx, wrapRef])

  const deleteSelectedClip = useCallback(() => {
    if (!selectedClip) return
    if (selectedClip.type === "video") {
      setVideoClips((prev) => prev.filter((c) => c.id !== selectedClip.id))
    } else {
      setAudioClips((prev) => prev.filter((c) => c.id !== selectedClip.id))
    }
    setSelectedClip(null)
  }, [selectedClip, setVideoClips, setAudioClips, setSelectedClip])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return
    if (!selectedClip) return
    const target = e.target as HTMLElement | null
    const tag = (target?.tagName ?? "").toLowerCase()
    if (tag === "input" || tag === "textarea" || target?.isContentEditable) return
    e.preventDefault()
    if (!confirm("确定要从时间轴删除该片段吗？")) return
    deleteSelectedClip()
  }

  const seekByClientX = useCallback(
    (clientX: number) => {
      if (!playheadActive) return
      if (!onSeekPlayheadSeconds) return
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const x = clientX - rect.left + wrap.scrollLeft - TRACK_OFFSET_PX
      const seconds = clamp(x / PX_PER_SECOND, 0, totalSeconds)
      onSeekPlayheadSeconds(seconds)
    },
    [onSeekPlayheadSeconds, playheadActive, totalSeconds, wrapRef]
  )

  const beginSeek = useCallback(
    (e: React.PointerEvent) => {
      if (!playheadActive) return
      if (!onSeekPlayheadSeconds) return
      e.preventDefault()
      e.stopPropagation()
      keyboardScopeRef.current?.focus()
      seekByClientX(e.clientX)

      const onMove = (ev: PointerEvent) => {
        seekByClientX(ev.clientX)
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [onSeekPlayheadSeconds, playheadActive, seekByClientX, keyboardScopeRef]
  )

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
        const raw = clamp(initialStart + dx, minStart, maxStart)

        const snapThresholdSeconds = 8 / PX_PER_SECOND
        const anchors: number[] = [0]
        for (const other of videoClips) {
          if (other.id === clip.id) continue
          anchors.push(other.start + Math.max(0, other.trimStart))
          anchors.push(other.start + other.duration - Math.max(0, other.trimEnd))
        }

        const visibleLen = clip.duration - Math.max(0, clip.trimEnd)
        const best = (() => {
          let bestStart: number | null = null
          let bestDelta = Number.POSITIVE_INFINITY
          for (const a of anchors) {
            const s1 = a - clip.trimStart
            const d1 = Math.abs((raw + clip.trimStart) - a)
            if (d1 <= snapThresholdSeconds && d1 < bestDelta) {
              bestDelta = d1
              bestStart = s1
            }
            const s2 = a - visibleLen
            const d2 = Math.abs((raw + visibleLen) - a)
            if (d2 <= snapThresholdSeconds && d2 < bestDelta) {
              bestDelta = d2
              bestStart = s2
            }
          }
          return bestStart
        })()

        const next = clamp(best ?? raw, minStart, maxStart)
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

  const onClipClick = (type: "video" | "audio", id: string, segmentId?: string) => {
    setSelectedClip({ type, id })
    keyboardScopeRef.current?.focus()
    if (segmentId) {
        onSelectSegment(segmentId)
    }
  }

  return {
    onDrop,
    onDragOver,
    onDragLeave,
    onKeyDown,
    playheadPx,
    beginSeek,
    makeTrimHandler,
    makeDragHandler,
    makeAudioDragHandler,
    onClipClick
  }
}
