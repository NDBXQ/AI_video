import type { ReactElement } from "react"
import layoutStyles from "../VideoAssetSidebarLayout.module.css"
import type { VideoAssetGroup } from "../VideoAssetSidebar"
import type { VideoAsset, TimelineSegment, Asset } from "@/shared/utils/timelineUtils"
import { AssetChip } from "./AssetChip"
import { CollapsibleSplitBlock } from "./CollapsibleSplitBlock"
import { buildCollapsedStorageKey, writeCollapsedState } from "./collapseStorage"
import { useCollapsedPreference } from "./useCollapsedPreference"

export function VideoAssetsTab({
  normalizedGroups,
  segmentFirstFrames,
  videoAssets,
  videoLibraryAssets,
  onUploadVideo,
  onOpenPreview
}: {
  normalizedGroups: VideoAssetGroup[]
  segmentFirstFrames?: Record<string, string>
  videoAssets: VideoAsset[]
  videoLibraryAssets: VideoAsset[]
  onUploadVideo: (file: File) => void
  onOpenPreview: (asset: Asset) => void
}): ReactElement {
  const scriptKey = buildCollapsedStorageKey({ tab: "video", block: "script" })
  const libraryKey = buildCollapsedStorageKey({ tab: "video", block: "library" })
  const scriptCollapsed = useCollapsedPreference(scriptKey, false)
  const libraryCollapsed = useCollapsedPreference(libraryKey, true)
  const totalScript = normalizedGroups.length > 0 ? normalizedGroups.reduce((acc, g) => acc + (g.segments?.length ?? 0), 0) : videoAssets.length
  return (
    <div className={layoutStyles.tabBody} aria-label="视频素材">
      <CollapsibleSplitBlock
        ariaLabel="脚本视频"
        label="脚本"
        title="视频"
        headerActions={<div className={layoutStyles.groupMeta}>{totalScript} 段</div>}
        collapsed={scriptCollapsed}
        contentId="video_script_assets"
        onToggle={() => {
          writeCollapsedState(scriptKey, !scriptCollapsed)
        }}
      >
        {normalizedGroups.length > 0 ? (
          <div className={layoutStyles.groupList} aria-label="按剧集分组的视频素材">
            {normalizedGroups.map((group) => (
              <div key={group.outlineId} className={layoutStyles.groupCard} aria-label={group.label}>
                <div className={layoutStyles.groupHeaderRow}>
                  <div className={layoutStyles.groupTag} title={group.label}>
                    {group.label}
                  </div>
                  <div className={layoutStyles.groupMeta}>{group.segments.length} 段</div>
                </div>
                <div className={layoutStyles.groupChips} aria-label={`${group.label} 视频列表`}>
                  {group.segments.map((seg: TimelineSegment) => {
                    const asset: VideoAsset = {
                      id: seg.id,
                      name: `${group.label} ${seg.title}`.trim(),
                      kind: "video",
                      src: seg.videoSrc ?? undefined,
                      durationSeconds: (seg as any).durationSeconds ?? null
                    }
                    const thumb = segmentFirstFrames?.[asset.id] ?? ""
                    return <AssetChip key={asset.id} asset={asset} thumbUrl={thumb} onOpenPreview={onOpenPreview} />
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={layoutStyles.chipList}>
            {videoAssets.length > 0 ? videoAssets.map((a) => <AssetChip key={a.id} asset={a} onOpenPreview={onOpenPreview} />) : <div className={layoutStyles.emptyHint}>暂无脚本视频</div>}
          </div>
        )}
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
                  onUploadVideo(file)
                  e.target.value = ""
                }}
              />
              添加
            </label>
          </>
        }
        collapsed={libraryCollapsed}
        contentId="video_library_assets"
        onToggle={() => {
          writeCollapsedState(libraryKey, !libraryCollapsed)
        }}
      >
        <div className={layoutStyles.chipList} aria-label="素材库视频列表">
          {videoLibraryAssets.length > 0 ? videoLibraryAssets.map((a) => <AssetChip key={a.id} asset={a} onOpenPreview={onOpenPreview} />) : <div className={layoutStyles.emptyHint}>暂无素材库视频</div>}
        </div>
      </CollapsibleSplitBlock>
    </div>
  )
}
