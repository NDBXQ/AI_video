
export type Thumbnail = { id: string; title: string; imageSrc: string }

export type TimelineSegment = {
  id: string
  title: string
  videoSrc?: string | null
  durationSeconds?: number | null
}

export type TimelineVideoClip = {
  id: string
  segmentId: string
  title: string
  start: number
  duration: number
  trimStart: number
  trimEnd: number
}

export type PreviewPlaylistItem = {
  key: string
  segmentId: string
  title: string
  videoSrc: string | null
  playDurationSeconds: number
  trimStartSeconds: number
  trimEndSeconds: number
}

export const normalizeDurationSeconds = (seg: TimelineSegment): number => {
  if (!seg.videoSrc) return 2
  const raw = Number(seg.durationSeconds ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return 2
  return raw
}

export const calculateTimelineVideoClips = (initialTimeline: any): TimelineVideoClip[] => {
  const raw = initialTimeline?.videoClips
  if (!Array.isArray(raw)) return []
  return raw
    .map((c: any) => ({
      id: String(c?.id ?? ""),
      segmentId: String(c?.segmentId ?? ""),
      title: String(c?.title ?? ""),
      start: Number(c?.start ?? 0),
      duration: Number(c?.duration ?? 0),
      trimStart: Number(c?.trimStart ?? 0),
      trimEnd: Number(c?.trimEnd ?? 0)
    }))
    .filter((c) => c.segmentId && Number.isFinite(c.start) && Number.isFinite(c.duration) && c.duration > 0)
}

export const calculatePreviewPlaylist = (
  isVideoTab: boolean,
  previewAllActive: boolean,
  segments: TimelineSegment[],
  timelineVideoClips: TimelineVideoClip[]
): PreviewPlaylistItem[] => {
  if (!previewAllActive) return []
  if (isVideoTab && timelineVideoClips.length > 0) {
    const byId = new Map<string, TimelineSegment>()
    for (const s of segments) byId.set(s.id, s)
    const sorted = [...timelineVideoClips].sort((a, b) => (a.start + a.trimStart) - (b.start + b.trimStart))
    return sorted.map((clip, idx) => {
      const seg = byId.get(clip.segmentId) ?? null
      const segDur = seg ? normalizeDurationSeconds(seg) : clip.duration
      const baseDur = Number.isFinite(segDur) && segDur > 0 ? segDur : clip.duration
      const trimStart = Math.max(0, Math.min(baseDur, Number.isFinite(clip.trimStart) ? clip.trimStart : 0))
      const trimEnd = Math.max(0, Math.min(baseDur - trimStart, Number.isFinite(clip.trimEnd) ? clip.trimEnd : 0))
      const play = Math.max(0.1, baseDur - trimStart - trimEnd)
      return {
        key: clip.id || `${clip.segmentId}:${idx}`,
        segmentId: clip.segmentId,
        title: clip.title || seg?.title || `镜 ${idx + 1}`,
        videoSrc: (seg?.videoSrc ?? "").trim() || null,
        playDurationSeconds: play,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd
      }
    })
  }

  return segments.map((seg, idx) => ({
    key: seg.id,
    segmentId: seg.id,
    title: seg.title,
    videoSrc: (seg.videoSrc ?? "").trim() || null,
    playDurationSeconds: normalizeDurationSeconds(seg),
    trimStartSeconds: 0,
    trimEndSeconds: 0
  }))
}
