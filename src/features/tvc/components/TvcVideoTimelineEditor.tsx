"use client"

import { useMemo, type ReactElement } from "react"
import { VideoTimelineEditor } from "@/shared/ui/videoTimeline/VideoTimelineEditor"
import type { TimelineSegment } from "@/shared/utils/timelineUtils"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"

export function TvcVideoTimelineEditor(props: {
  projectId: string
  shots: TimelineShot[]
  videoClipByOrdinal: Record<number, { url: string; durationSeconds?: number }>
  selectedShotId: string | null
  onSelectShotId: (id: string | null) => void
  initialTimeline: { videoClips: any[]; audioClips: any[] } | null
  onTimelineChange: (next: { videoClips: any[]; audioClips: any[] }) => void
  playheadSeconds?: number | null
  playheadActive?: boolean
  onSeekPlayheadSeconds?: (seconds: number) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
}): ReactElement {
  const segments = useMemo((): TimelineSegment[] => {
    return props.shots
      .slice()
      .sort((a, b) => (Number(a.sequence ?? 0) || 0) - (Number(b.sequence ?? 0) || 0))
      .map((s) => {
        const seq = Number(s.sequence ?? 0)
        const fromAssets = Number.isFinite(seq) && seq > 0 ? String(props.videoClipByOrdinal?.[seq]?.url ?? "").trim() : ""
        const videoSrc = fromAssets || null
        const durationSecondsRaw =
          typeof props.videoClipByOrdinal?.[seq]?.durationSeconds === "number"
            ? Number(props.videoClipByOrdinal?.[seq]?.durationSeconds)
            : typeof (s.scriptContent as any)?.["时长"] === "number"
              ? Number((s.scriptContent as any)?.["时长"])
              : null
        const durationSeconds = Number.isFinite(durationSecondsRaw as number) && (durationSecondsRaw as number) > 0 ? (durationSecondsRaw as number) : null
        return { id: s.id, title: `Shot ${String(s.sequence).padStart(2, "0")}`, videoSrc, durationSeconds }
      })
  }, [props.shots, props.videoClipByOrdinal])

  const segmentFirstFrames = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of props.shots) {
      const url = String(s.frames?.first?.thumbnailUrl ?? s.frames?.first?.url ?? "").trim()
      if (!url) continue
      out[s.id] = url
    }
    return out
  }, [props.shots])

  const activeId = useMemo(() => {
    const picked = (props.selectedShotId ?? "").trim()
    if (picked && segments.some((s) => s.id === picked)) return picked
    return segments[0]?.id ?? ""
  }, [props.selectedShotId, segments])

  return (
    <VideoTimelineEditor
      segments={segments}
      activeId={activeId}
      onSelectSegment={(id) => props.onSelectShotId(id)}
      segmentFirstFrames={segmentFirstFrames}
      timelineKey={`tvc:${props.projectId}`}
      initialTimeline={props.initialTimeline}
      onTimelineChange={props.onTimelineChange}
      playheadSeconds={props.playheadSeconds ?? null}
      playheadActive={props.playheadActive}
      onSeekPlayheadSeconds={props.onSeekPlayheadSeconds}
      onSeekStart={props.onSeekStart}
      onSeekEnd={props.onSeekEnd}
    />
  )
}
