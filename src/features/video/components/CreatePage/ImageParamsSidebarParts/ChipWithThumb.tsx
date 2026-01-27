import Image from "next/image"
import type { ReactElement } from "react"
import styles from "../ImageParamsSidebar.module.css"

export function ChipWithThumb({
  label,
  thumbUrl,
  onPreview,
  onPick
}: {
  label: string
  thumbUrl?: string | null
  onPreview?: () => void
  onPick?: () => void
}): ReactElement {
  const displayLabel = label.length > 3 ? `${label.slice(0, 3)}...` : label
  const interactive = Boolean(onPreview || onPick)
  return (
    <span
      className={styles.chip}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (!onPreview) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPreview()
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className={styles.chipThumb} aria-hidden="true">
        {thumbUrl ? <Image className={styles.chipThumbImg} src={thumbUrl} alt="" width={22} height={22} unoptimized /> : <span className={styles.chipThumbFallback} />}
      </span>
      <span className={styles.chipText} title={label}>
        {displayLabel}
      </span>
      {onPick ? (
        <button
          type="button"
          className={styles.chipPickBtn}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onPick()
          }}
          aria-label="从素材库选择参考图"
        >
          选
        </button>
      ) : null}
    </span>
  )
}
