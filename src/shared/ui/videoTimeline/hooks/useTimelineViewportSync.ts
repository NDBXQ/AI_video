import { useEffect, useMemo, useRef, type RefObject } from "react"
import { TRACK_OFFSET_PX, type VideoClip } from "@/shared/utils/timelineUtils"

export function useTimelineViewportSync(params: {
  wrapRef: RefObject<HTMLDivElement>
  isInteractingRef: RefObject<boolean>
  latestVideoClipsRef: RefObject<VideoClip[]>
  activeId: string
  playheadActive?: boolean
  playheadSeconds?: number | null
  totalSeconds: number
  pxPerSecond: number
}): void {
  const {
    wrapRef,
    isInteractingRef,
    latestVideoClipsRef,
    activeId,
    playheadActive,
    playheadSeconds,
    totalSeconds,
    pxPerSecond
  } = params

  const lastAutoScrollActiveIdRef = useRef<string>("")
  useEffect(() => {
    if (isInteractingRef.current) return
    const nextActiveId = (activeId ?? "").trim()
    if (!nextActiveId) return
    if (lastAutoScrollActiveIdRef.current === nextActiveId) return
    const el = wrapRef.current
    if (!el) return
    const clip = latestVideoClipsRef.current.find((c) => c.segmentId === nextActiveId)
    if (!clip) return
    lastAutoScrollActiveIdRef.current = nextActiveId
    const target = Math.max(0, TRACK_OFFSET_PX + Math.round(clip.start * pxPerSecond) - 120)
    el.scrollTo({ left: target, behavior: "smooth" })
  }, [activeId, isInteractingRef, latestVideoClipsRef, pxPerSecond, wrapRef])

  const playheadPx = useMemo(() => {
    if (!playheadActive) return null
    const s = Number(playheadSeconds ?? 0)
    if (!Number.isFinite(s) || s < 0) return null
    return TRACK_OFFSET_PX + s * pxPerSecond
  }, [playheadActive, playheadSeconds, pxPerSecond])

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
}
