import { useState, useMemo, useEffect, useRef } from 'react'
import {
  type TimelineSegment,
  type VideoClip,
  type AudioClip,
  safeDuration,
  TRACK_OFFSET_PX,
  TRACK_RIGHT_PADDING_PX,
  PX_PER_SECOND
} from '../../../utils/timelineUtils'

interface UseTimelineStateProps {
  segments: TimelineSegment[]
  timelineKey?: string
  initialTimeline?: { videoClips: VideoClip[]; audioClips: AudioClip[] } | null
  onTimelineChange?: (timeline: { videoClips: VideoClip[]; audioClips: AudioClip[] }) => void
}

export function useTimelineState({
  segments,
  timelineKey,
  initialTimeline,
  onTimelineChange
}: UseTimelineStateProps) {
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
  const [selectedClip, setSelectedClip] = useState<{ type: "video" | "audio"; id: string } | null>(null)

  const appliedKeyRef = useRef<string>("")

  // Handle initial timeline and key changes
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
        setVideoClips(initialTimeline.videoClips)
        setAudioClips(initialTimeline.audioClips)
        setSelectedClip(null)
      })
      return
    }
    schedule(() => {
      setVideoClips(initialVideoClips)
      setAudioClips([])
      setSelectedClip(null)
    })
  }, [initialTimeline, initialVideoClips, timelineKey])

  // Handle initial timeline when it's null (reset to segments)
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

  // Notify parent of changes
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

  const updateVideoClip = (id: string, patch: Partial<VideoClip>) => {
    setVideoClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const updateAudioClip = (id: string, patch: Partial<AudioClip>) => {
    setAudioClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  return {
    viewportSeconds,
    setViewportSeconds,
    videoClips,
    setVideoClips,
    audioClips,
    setAudioClips,
    dragOver,
    setDragOver,
    selectedClip,
    setSelectedClip,
    totalSeconds,
    widthPx,
    updateVideoClip,
    updateAudioClip
  }
}
