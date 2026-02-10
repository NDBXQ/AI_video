import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import shellStyles from "./VideoAssetSidebarShell.module.css"
import { type Asset, type AudioAsset, type MediaAsset, type TimelineSegment, type VideoAsset } from "@/shared/utils/timelineUtils"
import { usePublicResourceAssets } from "./VideoAssetSidebarParts/usePublicResourceAssets"
import { useScriptAudioAssets } from "./VideoAssetSidebarParts/useScriptAudioAssets"
import { VideoAssetsTab } from "./VideoAssetSidebarParts/VideoAssetsTab"
import { AudioAssetsTab } from "./VideoAssetSidebarParts/AudioAssetsTab"
import { ImageAssetsTab } from "./VideoAssetSidebarParts/ImageAssetsTab"
import { PreviewDock } from "./VideoAssetSidebarParts/PreviewDock"

export type VideoAssetGroup = {
  outlineId: string
  label: string
  segments: Array<TimelineSegment & { durationSeconds?: number | null; firstFrameSrc?: string | null }>
}

export function VideoAssetSidebar({
  onAssetsChange,
  videoSegments,
  videoGroups,
  segmentFirstFrames,
  storyboardId,
  ttsAudioVersion
}: {
  onAssetsChange?: (assets: { audio: AudioAsset[]; media: MediaAsset[] }) => void
  videoSegments?: TimelineSegment[]
  videoGroups?: VideoAssetGroup[]
  segmentFirstFrames?: Record<string, string>
  storyboardId?: string | null
  ttsAudioVersion?: number
}): ReactElement {
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image">("video")
  const mediaAssets = useMemo<MediaAsset[]>(() => [{ id: "media-1", name: "贴纸素材（示例）", kind: "media" }], [])
  const { audioAssets, videoLibraryAssets, uploadAudio, uploadVideo } = usePublicResourceAssets()
  const [previewMedia, setPreviewMedia] = useState<{ kind: "audio" | "video"; name: string; src: string } | null>(null)
  const scriptAudioAssets = useScriptAudioAssets({ storyboardId, activeTab, ttsAudioVersion })
  const videoAssets = useMemo<VideoAsset[]>(() => {
    const list = videoSegments ?? []
    return list
      .filter((s) => Boolean((s.videoSrc ?? "").trim()))
      .map((s) => ({ id: s.id, name: s.title, kind: "video" as const, src: s.videoSrc ?? undefined, durationSeconds: s.durationSeconds ?? null }))
  }, [videoSegments])

  const normalizedGroups = useMemo(() => {
    const groups = videoGroups ?? []
    return groups
      .map((g) => ({
        ...g,
        segments: (g.segments ?? []).filter((s) => Boolean((s.videoSrc ?? "").trim()))
      }))
      .filter((g) => g.segments.length > 0)
  }, [videoGroups])

  useEffect(() => {
    onAssetsChange?.({ audio: audioAssets, media: mediaAssets })
  }, [audioAssets, mediaAssets, onAssetsChange])

  const openPreview = useCallback((asset: Asset) => {
    const src = typeof (asset as any).src === "string" ? ((asset as any).src as string).trim() : ""
    if (!src) return
    if (asset.kind === "audio") setPreviewMedia({ kind: "audio", name: asset.name, src })
    if (asset.kind === "video") setPreviewMedia({ kind: "video", name: asset.name, src })
  }, [])

  return (
    <div className={shellStyles.assetPanel} aria-label="素材面板">
      <div className={shellStyles.topTabs} role="tablist" aria-label="素材类型">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "video"}
          className={`${shellStyles.topTab} ${activeTab === "video" ? shellStyles.topTabActive : ""}`}
          onClick={() => setActiveTab("video")}
        >
          视频
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "audio"}
          className={`${shellStyles.topTab} ${activeTab === "audio" ? shellStyles.topTabActive : ""}`}
          onClick={() => setActiveTab("audio")}
        >
          音频
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "image"}
          className={`${shellStyles.topTab} ${activeTab === "image" ? shellStyles.topTabActive : ""}`}
          onClick={() => setActiveTab("image")}
        >
          图片
        </button>
      </div>

      {activeTab === "video" ? (
        <VideoAssetsTab
          normalizedGroups={normalizedGroups}
          segmentFirstFrames={segmentFirstFrames}
          videoAssets={videoAssets}
          videoLibraryAssets={videoLibraryAssets}
          onUploadVideo={uploadVideo}
          onOpenPreview={openPreview}
        />
      ) : null}

      {activeTab === "audio" ? (
        <AudioAssetsTab
          scriptAudioAssets={scriptAudioAssets}
          audioAssets={audioAssets}
          onUploadAudio={uploadAudio}
          onOpenPreview={openPreview}
        />
      ) : null}

      {activeTab === "image" ? <ImageAssetsTab mediaAssets={mediaAssets} onOpenPreview={openPreview} /> : null}

      <PreviewDock previewMedia={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  )
}
