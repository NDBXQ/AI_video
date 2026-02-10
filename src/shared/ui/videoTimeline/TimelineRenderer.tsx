"use client"

import { useEffect, useMemo, useState, type ReactElement, type RefObject } from "react"
import styles from "./VideoTimelineEditor.module.css"
import { TimelineTrack } from "./TimelineTrack"
import { KonvaTimeRuler } from "./KonvaTimeRuler"
import { KonvaOverlay } from "./KonvaOverlay"
import { KonvaTrackClips } from "./KonvaTrackClips"
import { type VideoClip, type AudioClip, TRACK_OFFSET_PX, clamp } from "@/shared/utils/timelineUtils"

interface TimelineRendererProps {
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  activeId: string
  segmentFirstFrames?: Record<string, string>
  selectedClips: Array<{ type: "video" | "audio"; id: string }>
  pxPerSecond: number
  totalSeconds: number
  widthPx: number
  dragOver: boolean
  markers?: number[]
  onRemoveMarker?: (seconds: number) => void
  playheadActive?: boolean
  playheadSeconds?: number | null
  onSeekPlayheadSeconds?: (seconds: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
  timelineRef: RefObject<HTMLDivElement>
  wrapRef: RefObject<HTMLDivElement>
  keyboardScopeRef: RefObject<HTMLDivElement>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onVideoTrackPointerDown: (e: {
    clientX: number
    pointerId?: number
    pointerType?: string
    shiftKey?: boolean
    metaKey?: boolean
    ctrlKey?: boolean
  }) => void
  onAudioTrackPointerDown: (e: {
    clientX: number
    pointerId?: number
    pointerType?: string
    shiftKey?: boolean
    metaKey?: boolean
    ctrlKey?: boolean
  }) => void
  onZoom: (deltaY: number) => void
}

export function TimelineRenderer({
  videoClips,
  audioClips,
  activeId,
  segmentFirstFrames,
  selectedClips,
  pxPerSecond,
  totalSeconds,
  widthPx,
  dragOver,
  markers,
  onRemoveMarker,
  playheadActive,
  playheadSeconds,
  onSeekPlayheadSeconds,
  onSeekStart,
  onSeekEnd,
  timelineRef,
  wrapRef,
  keyboardScopeRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onKeyDown,
  onVideoTrackPointerDown,
  onAudioTrackPointerDown,
  onZoom,
}: TimelineRendererProps): ReactElement {
  const [timelineHeightPx, setTimelineHeightPx] = useState(0)
  const [viewportSeconds, setViewportSeconds] = useState<{ start: number; end: number }>({ start: 0, end: totalSeconds })
  const [viewportPx, setViewportPx] = useState<{ canvasStartPx: number; canvasWidthPx: number; laneStartPx: number; laneWidthPx: number }>({
    canvasStartPx: 0,
    canvasWidthPx: 0,
    laneStartPx: 0,
    laneWidthPx: 0
  })
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const apply = () => setTimelineHeightPx(el.clientHeight || 0)
    apply()
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => apply())
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener("resize", apply)
    return () => window.removeEventListener("resize", apply)
  }, [timelineRef])
  const laneTotalWidthPx = Math.max(0, Math.round(widthPx - TRACK_OFFSET_PX))
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const overscanSeconds = 2
    const calc = () => {
      const leftPx = el.scrollLeft
      const rightPx = leftPx + el.clientWidth
      const overscanPx = Math.max(0, Math.round(pxPerSecond * overscanSeconds))
      const canvasStartPx = Math.max(0, Math.min(widthPx, Math.round(leftPx - overscanPx)))
      const canvasWidthPx = Math.max(0, Math.min(widthPx - canvasStartPx, Math.round(el.clientWidth + overscanPx * 2)))
      const laneStartPx = Math.max(0, Math.min(laneTotalWidthPx, Math.round(leftPx - TRACK_OFFSET_PX - overscanPx)))
      const laneWidthPx = Math.max(0, Math.min(laneTotalWidthPx - laneStartPx, Math.round(el.clientWidth + overscanPx * 2)))
      const start = clamp((leftPx - TRACK_OFFSET_PX) / pxPerSecond - overscanSeconds, 0, totalSeconds)
      const end = clamp((rightPx - TRACK_OFFSET_PX) / pxPerSecond + overscanSeconds, 0, totalSeconds)
      setViewportSeconds((prev) => {
        if (Math.abs(prev.start - start) < 0.05 && Math.abs(prev.end - end) < 0.05) return prev
        return { start, end }
      })
      setViewportPx((prev) => {
        if (
          prev.canvasStartPx === canvasStartPx &&
          prev.canvasWidthPx === canvasWidthPx &&
          prev.laneStartPx === laneStartPx &&
          prev.laneWidthPx === laneWidthPx
        ) {
          return prev
        }
        return { canvasStartPx, canvasWidthPx, laneStartPx, laneWidthPx }
      })
    }
    calc()
    el.addEventListener("scroll", calc, { passive: true })
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => calc())
      ro.observe(el)
      return () => {
        el.removeEventListener("scroll", calc)
        ro.disconnect()
      }
    }
    window.addEventListener("resize", calc)
    return () => {
      el.removeEventListener("scroll", calc)
      window.removeEventListener("resize", calc)
    }
  }, [laneTotalWidthPx, pxPerSecond, totalSeconds, widthPx, wrapRef])
  const selectedKeySet = useMemo(() => {
    const set = new Set<string>()
    for (const s of selectedClips) set.add(`${s.type}:${s.id}`)
    return set
  }, [selectedClips])

  const renderTimeRuler = () => {
    return (
      <div className={styles.ruler}>
        <div className={styles.konvaWindow} style={{ left: viewportPx.canvasStartPx, width: viewportPx.canvasWidthPx, pointerEvents: "auto" }}>
          <KonvaTimeRuler
            totalSeconds={totalSeconds}
            pxPerSecond={pxPerSecond}
            widthPx={viewportPx.canvasWidthPx}
            viewportStartPx={viewportPx.canvasStartPx}
            viewportStartSeconds={viewportSeconds.start}
            viewportEndSeconds={viewportSeconds.end}
            markers={markers}
            onRemoveMarker={onRemoveMarker}
            playheadActive={playheadActive}
            onSeekPlayheadSeconds={onSeekPlayheadSeconds}
            onSeekStart={onSeekStart}
            onSeekEnd={onSeekEnd}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.editor}>
      <div
        className={`${styles.timelineWrap} ${dragOver ? styles.timelineWrapDragOver : ""}`}
        ref={keyboardScopeRef}
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onPointerDown={() => keyboardScopeRef.current?.focus()}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          onZoom(e.deltaY)
        }}
        onKeyDown={onKeyDown}
      >
        <div className={styles.timelineScroll} ref={wrapRef}>
          <div className={styles.timeline} ref={timelineRef} style={{ width: widthPx }}>
            {renderTimeRuler()}
            {timelineHeightPx > 0 ? (
              <div className={styles.konvaOverlay} aria-hidden>
                <div className={styles.konvaWindow} style={{ left: viewportPx.canvasStartPx, width: viewportPx.canvasWidthPx }}>
                  <KonvaOverlay
                    widthPx={viewportPx.canvasWidthPx}
                    heightPx={timelineHeightPx}
                    pxPerSecond={pxPerSecond}
                    viewportStartPx={viewportPx.canvasStartPx}
                    viewportStartSeconds={viewportSeconds.start}
                    viewportEndSeconds={viewportSeconds.end}
                    markers={markers}
                    playheadSeconds={playheadSeconds}
                    playheadActive={playheadActive}
                  />
                </div>
              </div>
            ) : null}
            <TimelineTrack label="视频">
              <div className={styles.trackKonva} style={{ left: viewportPx.laneStartPx, width: viewportPx.laneWidthPx }}>
                <KonvaTrackClips
                  widthPx={viewportPx.laneWidthPx}
                  heightPx={48}
                  pxPerSecond={pxPerSecond}
                  viewportStartPx={viewportPx.laneStartPx}
                  viewportStartSeconds={viewportSeconds.start}
                  viewportEndSeconds={viewportSeconds.end}
                  kind="video"
                  activeId={activeId}
                  clips={videoClips}
                  selectedClips={selectedClips}
                  segmentFirstFrames={segmentFirstFrames}
                  onStagePointerDown={(e) => {
                    const ev = e?.evt
                    if (!ev) return
                    ev.preventDefault?.()
                    onVideoTrackPointerDown({
                      clientX: ev.clientX,
                      pointerId: typeof ev.pointerId === "number" ? ev.pointerId : undefined,
                      pointerType: typeof ev.pointerType === "string" ? ev.pointerType : undefined,
                      shiftKey: Boolean(ev.shiftKey),
                      metaKey: Boolean(ev.metaKey),
                      ctrlKey: Boolean(ev.ctrlKey)
                    })
                  }}
                />
              </div>
            </TimelineTrack>

            <TimelineTrack label="音轨">
              <div className={styles.trackKonva} style={{ left: viewportPx.laneStartPx, width: viewportPx.laneWidthPx }}>
                <KonvaTrackClips
                  widthPx={viewportPx.laneWidthPx}
                  heightPx={48}
                  pxPerSecond={pxPerSecond}
                  viewportStartPx={viewportPx.laneStartPx}
                  viewportStartSeconds={viewportSeconds.start}
                  viewportEndSeconds={viewportSeconds.end}
                  kind="audio"
                  clips={audioClips}
                  selectedClips={selectedClips}
                  onStagePointerDown={(e) => {
                    const ev = e?.evt
                    if (!ev) return
                    ev.preventDefault?.()
                    onAudioTrackPointerDown({
                      clientX: ev.clientX,
                      pointerId: typeof ev.pointerId === "number" ? ev.pointerId : undefined,
                      pointerType: typeof ev.pointerType === "string" ? ev.pointerType : undefined,
                      shiftKey: Boolean(ev.shiftKey),
                      metaKey: Boolean(ev.metaKey),
                      ctrlKey: Boolean(ev.ctrlKey)
                    })
                  }}
                />
              </div>
            </TimelineTrack>
          </div>
        </div>
      </div>
    </div>
  )
}
