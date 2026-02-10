import { useMemo } from "react"
import type { StoryboardItem } from "@/features/video/types"
import type { VideoAssetGroup } from "../../components/VideoTimeline/VideoAssetSidebar"
import type { TimelineSegment } from "@/shared/utils/mediaPreviewUtils"

export function useTimelineSegments(params: {
  activeTab: "image" | "video"
  items: StoryboardItem[]
  previewVideoSrcById: Record<string, string>
  videoAssetGroups: VideoAssetGroup[]
}): TimelineSegment[] {
  const { activeTab, items, previewVideoSrcById, videoAssetGroups } = params

  return useMemo(() => {
    if (activeTab !== "video") return []

    const isHttpUrl = (v: string | null | undefined) => {
      const s = typeof v === "string" ? v.trim() : ""
      return s.startsWith("https://") || s.startsWith("http://")
    }

    if (videoAssetGroups.length > 0) {
      return videoAssetGroups.flatMap((g) =>
        (g.segments ?? []).map((s) => ({
          id: s.id,
          title: `${g.label} ${s.title}`.trim(),
          videoSrc: isHttpUrl(s.videoSrc) ? (s.videoSrc ?? "").trim() : null,
          durationSeconds: s.durationSeconds ?? null
        }))
      )
    }

    return items
      .map((it) => {
        const previewCandidate = (previewVideoSrcById[it.id] ?? "").trim()
        const storedCandidate = (it.videoInfo?.url ?? "").trim()
        const candidate = isHttpUrl(previewCandidate) ? previewCandidate : isHttpUrl(storedCandidate) ? storedCandidate : ""
        const durationSeconds =
          typeof it.videoInfo?.durationSeconds === "number" && Number.isFinite(it.videoInfo.durationSeconds) && it.videoInfo.durationSeconds > 0
            ? it.videoInfo.durationSeconds
            : null
        return { id: it.id, title: `镜 ${it.scene_no}`, videoSrc: candidate || null, durationSeconds }
      })
      .filter((s) => Boolean((s.videoSrc ?? "").trim()))
  }, [activeTab, items, previewVideoSrcById, videoAssetGroups])
}
