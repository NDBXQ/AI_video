import type { ReactElement } from "react"
import { LibraryCard, type LibraryItem } from "./LibraryCard"
import styles from "./LibraryGrid.module.css"

interface LibraryGridProps {
  items: LibraryItem[]
  view: "grid" | "list"
  onItemClick?: (item: LibraryItem) => void
  onViewOriginal?: (item: LibraryItem) => void
  selectedIds?: Set<string>
  onToggleSelected?: (id: string) => void
}

export function LibraryGrid({
  items,
  view,
  onItemClick,
  onViewOriginal,
  selectedIds,
  onToggleSelected,
}: LibraryGridProps): ReactElement {
  return (
    <div className={view === "grid" ? styles.grid : styles.list}>
      {items.map((item) => (
        <LibraryCard 
          key={item.id} 
          item={item} 
          view={view} 
          onClick={() => onItemClick?.(item)}
          selected={selectedIds?.has(item.id)}
          onToggleSelected={onToggleSelected ? () => onToggleSelected(item.id) : undefined}
          onViewOriginal={onViewOriginal ? () => onViewOriginal(item) : undefined}
        />
      ))}
    </div>
  )
}
