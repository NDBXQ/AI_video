"use client"

import { useCallback, useMemo, useState } from "react"
import { calculatePreviewPlaylist, calculateTimelineAudioClips, calculateTimelineVideoClips } from "@/shared/utils/mediaPreviewUtils"
import type { PreviewPlaylistItem, TimelineAudioClip, TimelineSegment, TimelineVideoClip } from "@/shared/utils/mediaPreviewUtils"

export function useTvcPreviewAllState(params: { segments: TimelineSegment[]; timelineDraft: { videoClips: any[]; audioClips: any[] } | null }): {
  previewAllActive: boolean
  previewAllPlaying: boolean
  previewAllSeeking: boolean
  hasAnyPlayableVideo: boolean
  currentItem: PreviewPlaylistItem | null
  currentItemDurationSeconds: number
  nextPreloadVideoSrc: string
  previewAllElapsedSeconds: number
  previewAllLocalTime: number
  timelineVideoClips: TimelineVideoClip[]
  timelineAudioClips: TimelineAudioClip[]
  playheadSeconds: number
  startPreviewAll: () => void
  stopPreviewAll: () => void
  togglePreviewAllPlaying: () => void
  advancePreviewAll: () => void
  updatePreviewAllLocalTime: (time: number) => void
  seekPlayheadSeconds: (seconds: number) => void
  onSeekStart: () => void
  onSeekEnd: () => void
} {
  const [previewAllActive, setPreviewAllActive] = useState(false)
  const [previewAllPlaying, setPreviewAllPlaying] = useState(false)
  const [previewAllIndex, setPreviewAllIndex] = useState(0)
  const [previewAllLocalTime, setPreviewAllLocalTime] = useState(0)
  const [previewAllSeeking, setPreviewAllSeeking] = useState(false)
  const [idlePlayheadSeconds, setIdlePlayheadSeconds] = useState(0)

  const timelineVideoClips = useMemo(() => calculateTimelineVideoClips(params.timelineDraft ?? null), [params.timelineDraft])
  const timelineAudioClips = useMemo(() => calculateTimelineAudioClips(params.timelineDraft ?? null), [params.timelineDraft])

  const hasAnyPlayableVideo = useMemo(() => {
    if (timelineVideoClips.some((c) => Boolean((c.src ?? "").trim()))) return true
    return params.segments.some((s) => Boolean((s.videoSrc ?? "").trim()))
  }, [params.segments, timelineVideoClips])

  const previewPlaylist = useMemo(
    () => calculatePreviewPlaylist(true, previewAllActive, params.segments, timelineVideoClips),
    [params.segments, previewAllActive, timelineVideoClips]
  )

  const currentItem = previewAllActive ? previewPlaylist[previewAllIndex] ?? null : null
  const currentItemDurationSeconds = currentItem ? currentItem.playDurationSeconds : 0

  const nextPreloadVideoSrc = useMemo(() => {
    if (!previewAllActive) return ""
    for (let i = previewAllIndex + 1; i < previewPlaylist.length; i += 1) {
      const src = (previewPlaylist[i]?.videoSrc ?? "").trim()
      if (src) return src
    }
    return ""
  }, [previewAllActive, previewAllIndex, previewPlaylist])

  const prefixPlaylistSeconds = useMemo(() => {
    if (!previewAllActive) return 0
    let sum = 0
    for (let i = 0; i < previewAllIndex; i += 1) sum += previewPlaylist[i]?.playDurationSeconds ?? 0
    return sum
  }, [previewAllActive, previewAllIndex, previewPlaylist])

  const previewAllElapsedSeconds = previewAllActive ? prefixPlaylistSeconds + previewAllLocalTime : 0

  const seekInPlaylist = useCallback(
    (seconds: number) => {
      const total = previewPlaylist.reduce((sum, it) => sum + (it.playDurationSeconds ?? 0), 0)
      const target = Math.max(0, Math.min(total, seconds))
      let sum = 0
      for (let i = 0; i < previewPlaylist.length; i += 1) {
        const dur = previewPlaylist[i]?.playDurationSeconds ?? 0
        if (i === previewPlaylist.length - 1 || target < sum + dur) {
          setPreviewAllIndex(i)
          setPreviewAllLocalTime(Math.max(0, target - sum))
          return
        }
        sum += dur
      }
    },
    [previewPlaylist]
  )

  const startPreviewAll = useCallback(() => {
    setPreviewAllActive(true)
    setPreviewAllPlaying(true)
    seekInPlaylist(idlePlayheadSeconds)
  }, [idlePlayheadSeconds, seekInPlaylist])

  const stopPreviewAll = useCallback(() => {
    setPreviewAllPlaying(false)
    setPreviewAllActive(false)
    setPreviewAllIndex(0)
    setPreviewAllLocalTime(0)
  }, [])

  const togglePreviewAllPlaying = useCallback(() => {
    setPreviewAllPlaying((v) => !v)
  }, [])

  const advancePreviewAll = useCallback(() => {
    setPreviewAllLocalTime(0)
    setPreviewAllIndex((prev) => {
      const next = prev + 1
      if (next >= previewPlaylist.length) {
        setPreviewAllPlaying(false)
        setPreviewAllActive(false)
        return 0
      }
      return next
    })
  }, [previewPlaylist.length])

  const updatePreviewAllLocalTime = useCallback((time: number) => {
    setPreviewAllLocalTime(time)
  }, [])

  const seekPlayheadSeconds = useCallback(
    (seconds: number) => {
      setIdlePlayheadSeconds(seconds)
      if (!previewAllActive) return
      seekInPlaylist(seconds)
    },
    [previewAllActive, seekInPlaylist]
  )

  const onSeekStart = useCallback(() => {
    setPreviewAllSeeking(true)
  }, [])

  const onSeekEnd = useCallback(() => {
    setPreviewAllSeeking(false)
  }, [])

  const playheadSeconds = previewAllActive ? previewAllElapsedSeconds : idlePlayheadSeconds

  return {
    previewAllActive,
    previewAllPlaying,
    previewAllSeeking,
    hasAnyPlayableVideo,
    currentItem,
    currentItemDurationSeconds,
    nextPreloadVideoSrc,
    previewAllElapsedSeconds,
    previewAllLocalTime,
    timelineVideoClips,
    timelineAudioClips,
    playheadSeconds,
    startPreviewAll,
    stopPreviewAll,
    togglePreviewAllPlaying,
    advancePreviewAll,
    updatePreviewAllLocalTime,
    seekPlayheadSeconds,
    onSeekStart,
    onSeekEnd
  }
}
