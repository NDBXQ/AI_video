"use client"

import type { ReactElement } from "react"
import { useCallback, useState } from "react"
import { UiSelect } from "@/components/ui-select/UiSelect"
import styles from "./LibraryToolbar.module.css"
import { LayoutGrid, List, Search, Upload, Sparkles, Trash2 } from "lucide-react"

export type ViewMode = "grid" | "list"

interface LibraryToolbarProps {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  onSearch: (query: string) => void
  variant?: "my" | "public"
  onUpload?: () => void
  onGenerate?: () => void
  deleteLabel?: string
  deleteDisabled?: boolean
  onDelete?: () => void
}

export function LibraryToolbar({
  view,
  onViewChange,
  onSearch,
  variant = "my",
  onUpload,
  onGenerate,
  deleteLabel,
  deleteDisabled,
  onDelete,
}: LibraryToolbarProps): ReactElement {
  const [sort, setSort] = useState("recent")

  const onSortChange = useCallback(
    (value: string) => {
      setSort(value)
    },
    [setSort]
  )

  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Search className={styles.searchIcon} strokeWidth={2} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="搜索标题、提示词、标签..."
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      
      {variant === "public" ? (
        <div className={styles.actionButtons}>
          <button type="button" className={styles.actionBtn} onClick={onUpload}>
            <Upload size={16} strokeWidth={2} />
            上传素材
          </button>
          <button type="button" className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={onGenerate}>
            <Sparkles size={16} strokeWidth={2} />
            AI 生成
          </button>
        </div>
      ) : null}

      <div className={styles.actions}>
        {deleteLabel && onDelete ? (
          <button type="button" className={styles.dangerBtn} onClick={onDelete} disabled={deleteDisabled}>
            <Trash2 size={16} strokeWidth={2} />
            {deleteLabel}
          </button>
        ) : null}
        <div className={styles.sortSelect}>
          <UiSelect
            value={sort}
            ariaLabel="排序"
            onChange={onSortChange}
            options={[
              { value: "recent", label: "最近更新" },
              { value: "created", label: "创建时间" },
              { value: "name", label: "名称" }
            ]}
          />
        </div>
        
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewBtn} ${view === "grid" ? styles.activeView : ""}`}
            onClick={() => onViewChange("grid")}
            aria-label="网格视图"
          >
            <LayoutGrid size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${view === "list" ? styles.activeView : ""}`}
            onClick={() => onViewChange("list")}
            aria-label="列表视图"
          >
            <List size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
