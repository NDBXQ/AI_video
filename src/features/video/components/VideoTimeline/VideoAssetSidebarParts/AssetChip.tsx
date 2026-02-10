import type { ReactElement } from "react"
import chipStyles from "../VideoAssetSidebarChips.module.css"
import { ASSET_MIME, type Asset } from "@/shared/utils/timelineUtils"

export function AssetChip({
  asset,
  thumbUrl,
  onSelect,
  onOpenPreview
}: {
  asset: Asset
  thumbUrl?: string
  onSelect?: (asset: Asset) => void
  onOpenPreview?: (asset: Asset) => void
}): ReactElement {
  const src = typeof (asset as any).src === "string" ? ((asset as any).src as string).trim() : ""
  const canPreview = (asset.kind === "video" || asset.kind === "audio") && Boolean(src) && Boolean(onOpenPreview)

  return (
    <div
      key={asset.id}
      className={chipStyles.chipItem}
      draggable
      onClick={() => onSelect?.(asset)}
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset))
        e.dataTransfer.setData("text/plain", JSON.stringify(asset))
        e.dataTransfer.effectAllowed = "copy"
      }}
      title={asset.name}
    >
      <span
        className={`${chipStyles.chipGrip} ${thumbUrl ? chipStyles.chipGripThumb : ""}`}
        style={thumbUrl ? ({ ["--chip-thumb-url" as any]: `url(${thumbUrl})` } as any) : undefined}
        aria-hidden
      />
      <span className={chipStyles.chipText}>{asset.name}</span>
      {canPreview ? (
        <button
          type="button"
          className={chipStyles.chipPreviewBtn}
          draggable={false}
          aria-label={asset.kind === "audio" ? "试听音频" : "预览视频"}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onOpenPreview?.(asset)
          }}
        >
          ▶
        </button>
      ) : null}
    </div>
  )
}
