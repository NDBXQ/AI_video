"use client"

import { useCallback, useMemo, useState, type ReactElement } from "react"
import shellStyles from "@/features/video/components/VideoTimeline/VideoAssetSidebarShell.module.css"
import layoutStyles from "@/features/video/components/VideoTimeline/VideoAssetSidebarLayout.module.css"
import type { Asset, VideoAsset } from "@/shared/utils/timelineUtils"
import { AssetChip } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/AssetChip"
import { CollapsibleSplitBlock } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/CollapsibleSplitBlock"
import { buildCollapsedStorageKey, writeCollapsedState } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/collapseStorage"
import { useCollapsedPreference } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/useCollapsedPreference"
import { PreviewDock } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/PreviewDock"
import { usePublicResourceAssets } from "@/features/video/components/VideoTimeline/VideoAssetSidebarParts/usePublicResourceAssets"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"
import { useTvcProjectAssets } from "@/features/tvc/workspace/hooks/useTvcProjectAssets"
import { TvcAssetMediaCard } from "@/features/tvc/components/TvcAssetMediaCard"

function safeInt(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) ? n : 0
}

export function TvcAssetSidebar(props: { projectId: string; shots: TimelineShot[]; onSelectShotId?: (id: string) => void }): ReactElement {
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image">("video")
  const { items, loading } = useTvcProjectAssets(props.projectId)
  const { videoLibraryAssets, uploadVideo } = usePublicResourceAssets()

  const openPreview = useCallback((asset: Asset) => {
    const src = typeof (asset as any).src === "string" ? ((asset as any).src as string).trim() : ""
    if (!src) return null
    if (asset.kind === "audio") return { kind: "audio" as const, name: asset.name, src }
    if (asset.kind === "video") return { kind: "video" as const, name: asset.name, src }
    return null
  }, [])

  const [previewMedia, setPreviewMedia] = useState<{ kind: "audio" | "video"; name: string; src: string } | null>(null)

  const shotIdBySequence = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of props.shots) {
      const seq = safeInt(s.sequence)
      if (seq > 0) map.set(seq, s.id)
    }
    return map
  }, [props.shots])

  const firstFrameThumbByShotId = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of props.shots) {
      const url = String(s.frames?.first?.thumbnailUrl ?? s.frames?.first?.url ?? "").trim()
      if (url) out[s.id] = url
    }
    for (const a of items) {
      if (a.kind !== "first_frame") continue
      const shotId = shotIdBySequence.get(a.ordinal) ?? ""
      if (!shotId) continue
      const thumb = String(a.thumbnailUrl ?? a.url ?? "").trim()
      if (thumb && !out[shotId]) out[shotId] = thumb
    }
    return out
  }, [items, props.shots, shotIdBySequence])

  const videoAssets = useMemo((): VideoAsset[] => {
    const out: VideoAsset[] = []
    for (const a of items) {
      if (a.kind !== "video_clip") continue
      const src = String(a.url ?? "").trim()
      if (!src) continue
      const mappedId = shotIdBySequence.get(a.ordinal) ?? `video_clip:${a.ordinal}`
      const name = shotIdBySequence.has(a.ordinal) ? `Shot ${String(a.ordinal).padStart(2, "0")}` : `Video ${String(a.ordinal).padStart(2, "0")}`
      if (out.some((v) => v.id === mappedId)) continue
      out.push({ id: mappedId, name, kind: "video", src })
    }
    return out
  }, [items, shotIdBySequence])

  const videoThumbByAssetId = useMemo(() => {
    const out: Record<string, string> = {}
    for (const a of items) {
      if (a.kind !== "video_clip") continue
      const mappedId = shotIdBySequence.get(a.ordinal) ?? `video_clip:${a.ordinal}`
      const thumb = String(a.thumbnailUrl ?? (a.meta as any)?.thumbnailUrl ?? "").trim()
      if (thumb) out[mappedId] = thumb
    }
    return out
  }, [items, shotIdBySequence])

  const userImages = useMemo(() => {
    return items
      .filter((a) => a.kind === "user_image")
      .map((a) => ({
        id: `user_image:${a.ordinal}`,
        ordinal: a.ordinal,
        url: String(a.thumbnailUrl ?? a.url ?? "").trim(),
        orig: String(a.url ?? "").trim()
      }))
      .filter((x) => x.url)
  }, [items])

  const referenceImages = useMemo(() => {
    return items
      .filter((a) => a.kind === "reference_image")
      .map((a) => ({
        id: `reference_image:${a.ordinal}`,
        ordinal: a.ordinal,
        url: String(a.thumbnailUrl ?? a.url ?? "").trim(),
        orig: String(a.url ?? "").trim()
      }))
      .filter((x) => x.url)
  }, [items])

  const firstFrames = useMemo(() => {
    return items
      .filter((a) => a.kind === "first_frame")
      .map((a) => ({
        id: `first_frame:${a.ordinal}`,
        ordinal: a.ordinal,
        url: String(a.thumbnailUrl ?? a.url ?? "").trim(),
        orig: String(a.url ?? "").trim()
      }))
      .filter((x) => x.url)
  }, [items])

  const videoScriptKey = buildCollapsedStorageKey({ tab: "video", block: "script" })
  const videoLibraryKey = buildCollapsedStorageKey({ tab: "video", block: "library" })
  const videoScriptCollapsed = useCollapsedPreference(videoScriptKey, false)
  const videoLibraryCollapsed = useCollapsedPreference(videoLibraryKey, false)

  const imageScriptKey = buildCollapsedStorageKey({ tab: "image", block: "script" })
  const imageLibraryKey = buildCollapsedStorageKey({ tab: "image", block: "library" })
  const imageScriptCollapsed = useCollapsedPreference(imageScriptKey, false)
  const imageLibraryCollapsed = useCollapsedPreference(imageLibraryKey, false)

  const handleSelectVideoAsset = useCallback(
    (assetId: string) => {
      const id = String(assetId ?? "").trim()
      if (!id) return
      if (!props.onSelectShotId) return
      if (!id.startsWith("video_clip:")) {
        props.onSelectShotId(id)
        return
      }
      const ord = safeInt(id.split(":")[1])
      if (!ord) return
      const mapped = shotIdBySequence.get(ord) ?? ""
      if (mapped) props.onSelectShotId(mapped)
    },
    [props, shotIdBySequence]
  )

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
        <div className={layoutStyles.tabBody} aria-label="视频素材">
          <CollapsibleSplitBlock
            ariaLabel="已生成视频"
            label="生成"
            title="视频"
            headerActions={<div className={layoutStyles.groupMeta}>{loading ? "加载中" : `${videoAssets.length} 段`}</div>}
            collapsed={videoScriptCollapsed}
            contentId="tvc_video_generated_assets"
            onToggle={() => writeCollapsedState(videoScriptKey, !videoScriptCollapsed)}
          >
            <div className={layoutStyles.chipList}>
              {videoAssets.length > 0 ? (
                videoAssets.map((a) => {
                  const thumbUrl = firstFrameThumbByShotId[a.id] ?? videoThumbByAssetId[a.id] ?? ""
                  return (
                    <AssetChip
                      key={a.id}
                      asset={a}
                      thumbUrl={thumbUrl}
                      onSelect={() => handleSelectVideoAsset(a.id)}
                      onOpenPreview={(asset) => {
                        const next = openPreview(asset)
                        if (next) setPreviewMedia(next)
                      }}
                    />
                  )
                })
              ) : (
                <div className={layoutStyles.emptyHint}>暂无已生成视频</div>
              )}
            </div>
          </CollapsibleSplitBlock>

          <CollapsibleSplitBlock
            ariaLabel="素材库视频"
            label="素材库"
            title="视频"
            headerActions={
              <>
                <div className={layoutStyles.groupMeta}>{videoLibraryAssets.length} 段</div>
                <label className={layoutStyles.uploadBtn}>
                  <input
                    type="file"
                    accept="video/*"
                    className={layoutStyles.uploadInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      uploadVideo(file)
                      e.target.value = ""
                    }}
                  />
                  添加
                </label>
              </>
            }
            collapsed={videoLibraryCollapsed}
            contentId="video_library_assets"
            onToggle={() => writeCollapsedState(videoLibraryKey, !videoLibraryCollapsed)}
          >
            <div className={layoutStyles.chipList} aria-label="素材库视频列表">
              {videoLibraryAssets.length > 0 ? (
                videoLibraryAssets.map((a) => <AssetChip key={a.id} asset={a} onOpenPreview={(asset) => {
                  const next = openPreview(asset)
                  if (next) setPreviewMedia(next)
                }} />)
              ) : (
                <div className={layoutStyles.emptyHint}>暂无素材库视频</div>
              )}
            </div>
          </CollapsibleSplitBlock>
        </div>
      ) : null}

      {activeTab === "audio" ? (
        <div className={layoutStyles.tabBody} aria-label="音频素材">
          <div className={layoutStyles.emptyHint}>当前 TVC 项目未接入音频资产</div>
        </div>
      ) : null}

      {activeTab === "image" ? (
        <div className={layoutStyles.tabBody} aria-label="图片素材">
          <CollapsibleSplitBlock
            ariaLabel="用户图片"
            label="用户"
            title="图片"
            headerActions={<div className={layoutStyles.groupMeta}>{loading ? "加载中" : `${userImages.length} 张`}</div>}
            collapsed={imageScriptCollapsed}
            contentId="tvc_user_images"
            onToggle={() => writeCollapsedState(imageScriptKey, !imageScriptCollapsed)}
          >
            <div className={layoutStyles.groupList} aria-label="用户图片列表">
              {userImages.length > 0 ? (
                userImages.map((img) => (
                  <TvcAssetMediaCard
                    key={img.id}
                    mediaType="image"
                    title={`用户图片 #${img.ordinal}`}
                    typeLabel="用户图片"
                    name={`用户图片 #${img.ordinal}`}
                    url={img.orig || img.url}
                    thumbnailUrl={img.url}
                    onOpen={() => {
                      const u = (img.orig || img.url).trim()
                      if (!u) return
                      globalThis.open(u, "_blank", "noreferrer")
                    }}
                  />
                ))
              ) : (
                <div className={layoutStyles.emptyHint}>暂无用户图片</div>
              )}
            </div>
          </CollapsibleSplitBlock>

          <CollapsibleSplitBlock
            ariaLabel="生成图片"
            label="生成"
            title="图片"
            headerActions={<div className={layoutStyles.groupMeta}>{loading ? "加载中" : `${referenceImages.length + firstFrames.length} 张`}</div>}
            collapsed={imageLibraryCollapsed}
            contentId="tvc_generated_images"
            onToggle={() => writeCollapsedState(imageLibraryKey, !imageLibraryCollapsed)}
          >
            <div className={layoutStyles.groupList} aria-label="生成图片列表">
              {referenceImages.length + firstFrames.length > 0 ? (
                <>
                  {referenceImages.map((img) => (
                    <TvcAssetMediaCard
                      key={img.id}
                      mediaType="image"
                      title={`参考图 #${img.ordinal}`}
                      typeLabel="参考图"
                      name={`参考图 #${img.ordinal}`}
                      url={img.orig || img.url}
                      thumbnailUrl={img.url}
                      onOpen={() => {
                        const u = (img.orig || img.url).trim()
                        if (!u) return
                        globalThis.open(u, "_blank", "noreferrer")
                      }}
                    />
                  ))}
                  {firstFrames.map((img) => (
                    <TvcAssetMediaCard
                      key={img.id}
                      mediaType="image"
                      title={`首帧 #${img.ordinal}`}
                      typeLabel="首帧"
                      name={`首帧 #${img.ordinal}`}
                      url={img.orig || img.url}
                      thumbnailUrl={img.url}
                      onOpen={() => {
                        const u = (img.orig || img.url).trim()
                        if (!u) return
                        globalThis.open(u, "_blank", "noreferrer")
                      }}
                    />
                  ))}
                </>
              ) : (
                <div className={layoutStyles.emptyHint}>暂无生成图片</div>
              )}
            </div>
          </CollapsibleSplitBlock>
        </div>
      ) : null}

      <PreviewDock previewMedia={previewMedia} onClose={() => setPreviewMedia(null)} />
    </div>
  )
}
