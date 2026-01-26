
export type Thumbnail = { id: string; title: string; imageSrc: string; firstFrameSrc?: string }

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
    const EPS = 1e-3
    const sorted = [...timelineVideoClips].sort((a, b) => (a.start + a.trimStart) - (b.start + b.trimStart))
    const out: PreviewPlaylistItem[] = []
    const contentSeconds = sorted.reduce((m, c) => Math.max(m, Number(c?.start ?? 0) + Math.max(0, Number(c?.duration ?? 0))), 0)
    let cursor = 0
    for (let i = 0; i < sorted.length; i += 1) {
      const clip = sorted[i]!
      const seg = byId.get(clip.segmentId) ?? null
      const segDur = seg ? normalizeDurationSeconds(seg) : clip.duration
      const baseDur = Number.isFinite(segDur) && segDur > 0 ? segDur : clip.duration
      const start = Number.isFinite(clip.start) ? clip.start : 0
      const trimStart = Math.max(0, Math.min(baseDur, Number.isFinite(clip.trimStart) ? clip.trimStart : 0))
      const trimEnd = Math.max(0, Math.min(baseDur - trimStart, Number.isFinite(clip.trimEnd) ? clip.trimEnd : 0))
      const visibleStart = start + trimStart
      const visibleEnd = start + baseDur - trimEnd
      const play = Math.max(0, visibleEnd - visibleStart)
      if (play <= EPS) continue

      if (visibleStart > cursor + EPS) {
        out.push({
          key: `gap:${Math.round(cursor * 1000)}:${i}`,
          segmentId: "",
          title: "空白",
          videoSrc: null,
          playDurationSeconds: visibleStart - cursor,
          trimStartSeconds: 0,
          trimEndSeconds: 0
        })
      }

      out.push({
        key: clip.id || `${clip.segmentId}:${i}`,
        segmentId: clip.segmentId,
        title: clip.title || seg?.title || `镜 ${i + 1}`,
        videoSrc: (seg?.videoSrc ?? "").trim() || null,
        playDurationSeconds: play,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd
      })

      cursor = visibleEnd
    }

    if (contentSeconds > cursor + EPS) {
      out.push({
        key: `gap:${Math.round(cursor * 1000)}:tail`,
        segmentId: "",
        title: "空白",
        videoSrc: null,
        playDurationSeconds: contentSeconds - cursor,
        trimStartSeconds: 0,
        trimEndSeconds: 0
      })
    }

    return out
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
