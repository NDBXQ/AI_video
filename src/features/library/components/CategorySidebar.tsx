import type { ReactElement } from "react"
import styles from "./CategorySidebar.module.css"

export type CategoryId = string

export type CategoryOption = {
  id: CategoryId
  label: string
}

interface CategorySidebarProps {
  value: CategoryId
  onChange: (category: CategoryId) => void
  categories: CategoryOption[]
  counts?: Record<string, number>
  title?: string
}

export function CategorySidebar({
  value,
  onChange,
  categories,
  counts,
  title = "分类",
}: CategorySidebarProps): ReactElement {
  return (
    <div className={styles.sidebar}>
      <div className={styles.title}>{title}</div>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`${styles.item} ${value === cat.id ? styles.active : ""}`}
          onClick={() => onChange(cat.id)}
        >
          <span>{cat.label}</span>
          <span className={styles.badge}>{counts?.[cat.id] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
