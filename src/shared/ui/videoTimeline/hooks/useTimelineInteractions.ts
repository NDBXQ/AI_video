import { useEffect, useRef, type RefObject } from "react"
import type { AudioClip, TimelineSegment, VideoClip } from "@/shared/utils/timelineUtils"
import { useTimelineDragAndDrop } from "./useTimelineDragAndDrop"
import { useTimelineViewportSync } from "./useTimelineViewportSync"
import { useTimelineKeyboardDelete } from "./useTimelineKeyboardDelete"
import { useTimelineTrackInteractions } from "./useTimelineTrackInteractions"

interface UseTimelineInteractionsProps {
  segments: TimelineSegment[]
  videoClips: VideoClip[]
  setVideoClips: React.Dispatch<React.SetStateAction<VideoClip[]>>
  audioClips: AudioClip[]
  setAudioClips: React.Dispatch<React.SetStateAction<AudioClip[]>>
  selectedClips: Array<{ type: "video" | "audio"; id: string }>
  setSelectedClips: React.Dispatch<React.SetStateAction<Array<{ type: "video" | "audio"; id: string }>>>
  dragOver: boolean
  setDragOver: (over: boolean) => void
  totalSeconds: number
  pxPerSecond: number
  updateVideoClip: (id: string, patch: Partial<VideoClip>) => void
  updateAudioClip: (id: string, patch: Partial<AudioClip>) => void
  timelineRef: RefObject<HTMLDivElement>
  wrapRef: RefObject<HTMLDivElement>
  keyboardScopeRef: RefObject<HTMLDivElement>
  playheadActive?: boolean
  playheadSeconds?: number | null
  onSeekPlayheadSeconds?: (seconds: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
  activeId: string
  onSelectSegment: (id: string) => void
  markers: number[]
  setMarkers: React.Dispatch<React.SetStateAction<number[]>>
  onZoom: (deltaY: number) => void
}

export function useTimelineInteractions({
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
  timelineRef,
  wrapRef,
  keyboardScopeRef,
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
}: UseTimelineInteractionsProps) {
  const isInteractingRef = useRef(false)
  const latestVideoClipsRef = useRef(videoClips)
  useEffect(() => {
    latestVideoClipsRef.current = videoClips
  }, [videoClips])

  const latestAudioClipsRef = useRef(audioClips)
  useEffect(() => {
    latestAudioClipsRef.current = audioClips
  }, [audioClips])

  const latestSelectedClipsRef = useRef(selectedClips)
  useEffect(() => {
    latestSelectedClipsRef.current = selectedClips
  }, [selectedClips])

  const { onDrop, onDragOver, onDragLeave } = useTimelineDragAndDrop({
    segments,
    totalSeconds,
    pxPerSecond,
    timelineRef,
    keyboardScopeRef,
    dragOver,
    setDragOver,
    setVideoClips,
    setAudioClips,
    setSelectedClips,
    onSelectSegment
  })

  useTimelineViewportSync({
    wrapRef,
    isInteractingRef,
    latestVideoClipsRef,
    activeId,
    playheadActive,
    playheadSeconds,
    totalSeconds,
    pxPerSecond
  })

  const { onKeyDown } = useTimelineKeyboardDelete({
    selectedClips,
    setSelectedClips,
    setVideoClips,
    setAudioClips,
    markers,
    setMarkers,
    playheadActive,
    playheadSeconds,
    onSeekPlayheadSeconds,
    totalSeconds,
    onZoom
  })

  const { onVideoTrackPointerDown, onAudioTrackPointerDown } = useTimelineTrackInteractions({
    videoClips,
    audioClips,
    markers,
    pxPerSecond,
    wrapRef,
    keyboardScopeRef,
    setSelectedClips,
    updateVideoClip,
    updateAudioClip,
    onSelectSegment,
    onSeekPlayheadSeconds
  })

  return { onDrop, onDragOver, onDragLeave, onKeyDown, onVideoTrackPointerDown, onAudioTrackPointerDown }
}
