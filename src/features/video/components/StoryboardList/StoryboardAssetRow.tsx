import type { ReactElement } from "react"
import styles from "./StoryboardAssetRow.module.css"

export type StoryboardAssetRowItem = {
  id: string
  name: string
  url: string
  thumbnailUrl?: string | null
  category?: string
  storyboardId?: string | null
  description?: string | null
  prompt?: string | null
  tag?: string | null
}

type StoryboardAssetRowProps = {
  title: string
  items: StoryboardAssetRowItem[]
  onClickItem: (it: StoryboardAssetRowItem) => void
  isPlaceholderId: (id: string) => boolean
}

export function StoryboardAssetRow({ title, items, onClickItem, isPlaceholderId }: StoryboardAssetRowProps): ReactElement {
  return (
    <div className={styles.row} aria-label={title}>
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>{title}</div>
        <div className={styles.rowMeta}>{items.length > 0 ? `${items.length} 个` : "暂无"}</div>
      </div>
      {items.length > 0 ? (
        <div className={styles.scroller} role="list">
          {items.map((img) => (
            <button
              key={img.id}
              type="button"
              className={styles.card}
              onClick={() => onClickItem(img)}
              aria-label={`预览 ${img.name}`}
              title={img.name}
              role="listitem"
            >
              <img className={styles.cardImg} src={img.thumbnailUrl ?? img.url} alt={img.name} />
              <div className={styles.cardFooter}>
                <div className={styles.cardName}>{img.name}</div>
                {img.tag ? <div className={styles.tag}>{img.tag}</div> : isPlaceholderId(img.id) ? <div className={styles.badge}>未生成</div> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>暂无素材</div>
      )}
    </div>
  )
}
