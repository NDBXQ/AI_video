import { type ReactElement } from "react"
import type { StoryboardItem } from "../../types"
import type { ScriptGenerateState } from "../../hooks/useScriptGeneration"
import styles from "./StoryboardTable.module.css"
import { StoryboardTableRow } from "./StoryboardTableRow"

type StoryboardTableProps = {
  items: StoryboardItem[]
  selectedItems: Set<string>
  scriptGenerateById: Record<string, ScriptGenerateState>
  previewsById: Record<
    string,
    {
      role: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
      background: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
      item: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
    }
  >
  isLoading: boolean
  onSelectAll: () => void
  onSelect: (id: string) => void
  onPreviewImage: (
    title: string,
    imageSrc: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => void
  onOpenEdit: (itemId: string, initialValue: string) => void
  onDelete: (id: string) => void
}

export function StoryboardTable({
  items,
  selectedItems,
  scriptGenerateById,
  previewsById,
  isLoading,
  onSelectAll,
  onSelect,
  onPreviewImage,
  onOpenEdit,
  onDelete
}: StoryboardTableProps): ReactElement {
  const showSkeleton = isLoading && items.length === 0
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colCheckbox}>
              <input type="checkbox" checked={items.length > 0 && selectedItems.size === items.length} onChange={onSelectAll} />
            </th>
            <th className={styles.colNo}>镜号</th>
            <th className={styles.colVisual}>分镜描述</th>
            <th className={styles.colRole}>角色</th>
            <th className={styles.colBackground}>背景</th>
            <th className={styles.colItems}>物品</th>
            <th className={styles.colActions}>操作</th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className={styles.colCheckbox}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colNo}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colVisual}><div className={styles.skeletonBox} style={{ height: 44 }} /></td>
                  <td className={styles.colRole}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colBackground}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colItems}><div className={styles.skeletonBox} /></td>
                  <td className={styles.colActions}><div className={styles.skeletonBox} /></td>
                </tr>
              ))
            : items.map((item) => (
                <StoryboardTableRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  generationState={scriptGenerateById[item.id]}
                  onSelect={onSelect}
                  previews={previewsById[item.id]}
                  onPreviewImage={onPreviewImage}
                  onOpenEdit={onOpenEdit}
                  onDelete={onDelete}
                />
              ))}
        </tbody>
      </table>
    </div>
  )
}
