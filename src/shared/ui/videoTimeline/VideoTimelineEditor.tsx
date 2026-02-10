"use client"

import { useCallback, useEffect, useRef, type ReactElement } from "react"
import { useTimelineState } from "./hooks/useTimelineState"
import { useTimelineInteractions } from "./hooks/useTimelineInteractions"
import { TimelineRenderer } from "./TimelineRenderer"
import type { TimelineSegment, VideoClip, AudioClip } from "@/shared/utils/timelineUtils"

export function VideoTimelineEditor({
  segments,
  activeId,
  onSelectSegment,
  segmentFirstFrames,
  timelineKey,
  initialTimeline,
  onTimelineChange,
  playheadSeconds,
  playheadActive,
  onSeekPlayheadSeconds,
  onSeekStart,
  onSeekEnd
}: {
  segments: TimelineSegment[]
  activeId: string
  onSelectSegment: (id: string) => void
  segmentFirstFrames?: Record<string, string>
  timelineKey?: string
  initialTimeline?: { videoClips: VideoClip[]; audioClips: AudioClip[] } | null
  onTimelineChange?: (timeline: { videoClips: VideoClip[]; audioClips: AudioClip[] }) => void
  playheadSeconds?: number | null
  playheadActive?: boolean
  onSeekPlayheadSeconds?: (seconds: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
}): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const keyboardScopeRef = useRef<HTMLDivElement>(null)

  const {
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
    updateAudioClip
  } = useTimelineState({
    segments,
    timelineKey,
    initialTimeline,
    onTimelineChange
  })

  const onZoom = useCallback(
    (deltaY: number) => {
      const step = deltaY > 0 ? -6 : 6
      setPxPerSecond((prev: number) => Math.max(24, Math.min(192, Math.round(prev + step))))
    },
    [setPxPerSecond]
  )

  const { onDrop, onDragOver, onDragLeave, onKeyDown, onVideoTrackPointerDown, onAudioTrackPointerDown } =
    useTimelineInteractions({
      segments,
      videoClips,
      setVideoClips,
      audioClips,
      setAudioClips,
      selectedClips,
      setSelectedClips,
      dragOver,
      setDragOver,
      totalSeconds,
      pxPerSecond,
      updateVideoClip,
      updateAudioClip,
      timelineRef: timelineRef as React.RefObject<HTMLDivElement>,
      wrapRef: wrapRef as React.RefObject<HTMLDivElement>,
      keyboardScopeRef: keyboardScopeRef as React.RefObject<HTMLDivElement>,
      playheadActive,
      playheadSeconds,
      onSeekPlayheadSeconds,
      onSeekStart,
      onSeekEnd,
      activeId,
      onSelectSegment,
      markers,
      setMarkers,
      onZoom
    })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const calc = () => {
      const w = el.clientWidth
      const next = w > 0 ? Math.max(4, Math.ceil(w / pxPerSecond)) : 0
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
  }, [pxPerSecond, setViewportSeconds])

  return (
    <TimelineRenderer
      videoClips={videoClips}
      audioClips={audioClips}
      activeId={activeId}
      segmentFirstFrames={segmentFirstFrames}
      selectedClips={selectedClips}
      pxPerSecond={pxPerSecond}
      totalSeconds={totalSeconds}
      widthPx={widthPx}
      dragOver={dragOver}
      markers={markers}
      onRemoveMarker={(seconds: number) => setMarkers((prev: number[]) => prev.filter((m: number) => Math.abs(m - seconds) > 1e-3))}
      playheadActive={playheadActive}
      playheadSeconds={playheadSeconds}
      onSeekPlayheadSeconds={onSeekPlayheadSeconds}
      onSeekStart={onSeekStart}
      onSeekEnd={onSeekEnd}
      timelineRef={timelineRef as React.RefObject<HTMLDivElement>}
      wrapRef={wrapRef as React.RefObject<HTMLDivElement>}
      keyboardScopeRef={keyboardScopeRef as React.RefObject<HTMLDivElement>}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onKeyDown={onKeyDown}
      onVideoTrackPointerDown={onVideoTrackPointerDown}
      onAudioTrackPointerDown={onAudioTrackPointerDown}
      onZoom={onZoom}
    />
  )
}
