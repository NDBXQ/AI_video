import type { ReactElement } from "react"
import audioStyles from "../VideoAssetSidebarAudio.module.css"
import { ASSET_MIME } from "@/shared/utils/timelineUtils"

export function AudioRow({
  id,
  name,
  src,
  content,
  draggableAsset,
  onOpenPreview
}: {
  id: string
  name: string
  src?: string
  content?: string
  draggableAsset: any
  onOpenPreview?: (asset: any) => void
}): ReactElement {
  return (
    <div
      key={id}
      className={`${audioStyles.audioItem} ${content ? audioStyles.audioItemHasSub : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_MIME, JSON.stringify(draggableAsset))
        e.dataTransfer.setData("text/plain", JSON.stringify(draggableAsset))
        e.dataTransfer.effectAllowed = "copy"
      }}
      title={content || name}
    >
      <span className={audioStyles.audioGrip} aria-hidden />
      <div className={audioStyles.audioMain}>
        <span className={audioStyles.audioText}>{name}</span>
        {content ? <span className={audioStyles.audioSubText}>{content}</span> : null}
      </div>
      {src && onOpenPreview ? (
        <button
          type="button"
          className={audioStyles.audioPreviewBtn}
          draggable={false}
          aria-label="试听音频"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onOpenPreview(draggableAsset)
          }}
        >
          ▶
        </button>
      ) : null}
    </div>
  )
}
