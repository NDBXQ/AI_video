"use client"

import type { ReactElement } from "react"
import { LibraryGrid } from "./LibraryGrid"
import type { LibraryItem } from "./LibraryCard"
import styles from "./MyStoriesGroupedGrid.module.css"
import { EmptyState } from "@/components/empty-state/EmptyState"

interface MyStoriesGroupedGridProps {
  items: LibraryItem[]
  view: "grid" | "list"
  onItemClick?: (item: LibraryItem) => void
  onViewContent?: (item: LibraryItem) => void
  selectedIds?: Set<string>
  onToggleSelected?: (id: string) => void
  emptyStandardText?: string
  emptyTvcText?: string
  onCreateTvc?: () => void
  showStandard?: boolean
  showTvc?: boolean
}

function Group({
  title,
  items,
  view,
  onItemClick,
  onViewContent,
  selectedIds,
  onToggleSelected,
  emptyText,
  actionLabel,
  actionHref,
  onAction,
  learnHref,
}: {
  title: string
  items: LibraryItem[]
  view: "grid" | "list"
  onItemClick?: (item: LibraryItem) => void
  onViewContent?: (item: LibraryItem) => void
  selectedIds?: Set<string>
  onToggleSelected?: (id: string) => void
  emptyText?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  learnHref?: string
}): ReactElement {
  const primaryAction =
    actionLabel && actionHref ? { label: actionLabel, href: actionHref } : actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined

  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <div className={styles.groupTitle}>{title}</div>
        <div className={styles.groupMeta}>{items.length}</div>
      </div>
      <div className={styles.divider} />
      {items.length > 0 ? (
        <LibraryGrid
          items={items}
          view={view}
          onItemClick={onItemClick}
          onViewContent={onViewContent}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
        />
      ) : (
        <EmptyState
          size="inline"
          title={emptyText ?? "暂无内容"}
          description="建议先从剧本创作开始，后续素材生成、成片导出都会沉淀在这里。"
          primaryAction={primaryAction}
          learnHref={learnHref}
        />
      )}
    </div>
  )
}

export function MyStoriesGroupedGrid({
  items,
  view,
  onItemClick,
  onViewContent,
  selectedIds,
  onToggleSelected,
  emptyStandardText,
  emptyTvcText,
  onCreateTvc,
  showStandard = true,
  showTvc = true,
}: MyStoriesGroupedGridProps): ReactElement {
  const standardItems = items.filter((i) => i.type !== "tvc")
  const tvcItems = items.filter((i) => i.type === "tvc")

  return (
    <div className={styles.wrap}>
      {showStandard ? (
        <Group
          title="标准视频生成"
          items={standardItems}
          view={view}
          onItemClick={onItemClick}
          onViewContent={onViewContent}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          emptyText={emptyStandardText ?? "暂无标准视频项目"}
          actionLabel="去创作剧本"
          actionHref="/script/workspace?mode=brief"
          learnHref="/help?topic=library"
        />
      ) : null}
      {showTvc ? (
        <Group
          title="TVC 视频生成"
          items={tvcItems}
          view={view}
          onItemClick={onItemClick}
          onViewContent={onViewContent}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          emptyText={emptyTvcText ?? "暂无 TVC 项目"}
          actionLabel={onCreateTvc ? "去创建" : undefined}
          onAction={onCreateTvc}
          learnHref="/help?topic=tvc"
        />
      ) : null}
    </div>
  )
}
