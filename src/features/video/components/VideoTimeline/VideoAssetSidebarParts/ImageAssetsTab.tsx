import type { ReactElement } from "react"
import layoutStyles from "../VideoAssetSidebarLayout.module.css"
import type { Asset, MediaAsset } from "@/shared/utils/timelineUtils"
import { AssetChip } from "./AssetChip"
import { CollapsibleSplitBlock } from "./CollapsibleSplitBlock"
import { buildCollapsedStorageKey, writeCollapsedState } from "./collapseStorage"
import { useCollapsedPreference } from "./useCollapsedPreference"

export function ImageAssetsTab({
  mediaAssets,
  onOpenPreview
}: {
  mediaAssets: MediaAsset[]
  onOpenPreview: (asset: Asset) => void
}): ReactElement {
  const scriptKey = buildCollapsedStorageKey({ tab: "image", block: "script" })
  const libraryKey = buildCollapsedStorageKey({ tab: "image", block: "library" })
  const scriptCollapsed = useCollapsedPreference(scriptKey, false)
  const libraryCollapsed = useCollapsedPreference(libraryKey, true)
  return (
    <div className={layoutStyles.tabBody} aria-label="图片素材">
      <CollapsibleSplitBlock
        ariaLabel="脚本图片"
        label="脚本"
        title="图片"
        headerActions={<div className={layoutStyles.groupMeta}>0 张</div>}
        collapsed={scriptCollapsed}
        contentId="image_script_assets"
        onToggle={() => {
          writeCollapsedState(scriptKey, !scriptCollapsed)
        }}
      >
        <div className={layoutStyles.emptyHint}>暂无脚本图片</div>
      </CollapsibleSplitBlock>

      <CollapsibleSplitBlock
        ariaLabel="素材库图片"
        label="素材库"
        title="图片"
        headerActions={<div className={layoutStyles.groupMeta}>{mediaAssets.length} 张</div>}
        collapsed={libraryCollapsed}
        contentId="image_library_assets"
        onToggle={() => {
          writeCollapsedState(libraryKey, !libraryCollapsed)
        }}
      >
        <div className={layoutStyles.chipList}>
          {mediaAssets.length > 0 ? mediaAssets.map((a) => <AssetChip key={a.id} asset={a} onOpenPreview={onOpenPreview} />) : <div className={layoutStyles.emptyHint}>暂无素材库图片</div>}
        </div>
      </CollapsibleSplitBlock>
    </div>
  )
}
