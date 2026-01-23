"use client"

import type { ReactElement } from "react"
import styles from "./BulkActionBar.module.css"

interface BulkActionBarProps {
  selectedCount: number
  deleting: boolean
  onClear: () => void
  onDelete: () => void
}

export function BulkActionBar({ selectedCount, deleting, onClear, onDelete }: BulkActionBarProps): ReactElement | null {
  if (selectedCount <= 0) return null

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        已选择 <span className={styles.count}>{selectedCount}</span> 项
      </div>
      <div className={styles.right}>
        <button type="button" className={styles.btn} onClick={onClear} disabled={deleting}>
          清空
        </button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={onDelete} disabled={deleting}>
          删除
        </button>
      </div>
    </div>
  )
}

