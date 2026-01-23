
"use client"

import Link from "next/link"
import styles from "./OutlineNav.module.css"
import type { ScriptWorkspaceMode, RewriteState, OutlineItem } from "../utils"
import { deriveLiveRewrite } from "../utils"

type OutlineNavProps = Readonly<{
  outlines: ReadonlyArray<OutlineItem>
  activeOutline: OutlineItem | null
  rewriteBySeq: Record<number, RewriteState>
  storyId: string
  mode: ScriptWorkspaceMode
  deletingOutlineId: string | null
  setConfirmDeleteOutlineId: (id: string) => void
}>

/**
 * 左侧大纲导航栏组件
 * @param {OutlineNavProps} props - 组件属性
 * @returns {JSX.Element} 组件内容
 */
export function OutlineNav({
  outlines,
  activeOutline,
  rewriteBySeq,
  storyId,
  mode,
  deletingOutlineId,
  setConfirmDeleteOutlineId
}: OutlineNavProps) {
  return (
    <nav className={styles.outlineNav} aria-label="选择剧本大纲章节">
      <div className={styles.outlineNavHeader}>
        <div className={styles.outlineNavTitle}>大纲章节</div>
        <div className={styles.outlineNavHint}>选择后在右侧查看</div>
      </div>
      <div className={styles.outlineNavList}>
        {outlines.length === 0 ? <div className={styles.outlineNavEmpty}>暂无大纲</div> : null}
        {outlines.map((item) => {
          const isActive = item.sequence === activeOutline?.sequence
          const href = `/script/workspace/${encodeURIComponent(storyId)}?mode=${mode}&outline=${item.sequence}`
          const rewriteState = rewriteBySeq[item.sequence]
          const live = rewriteState?.raw ? deriveLiveRewrite(rewriteState.raw) : undefined
          const badgeText =
            rewriteState?.status === "streaming"
              ? "改写中"
              : rewriteState?.status === "done"
              ? "已改写"
              : rewriteState?.status === "error"
              ? "改写失败"
              : item.activeOutlineDraftId
              ? "已改写"
              : null
          const badgeClass =
            rewriteState?.status === "streaming"
              ? `${styles.badge} ${styles.badgeProcessing}`
              : rewriteState?.status === "done"
              ? `${styles.badge} ${styles.badgeDone}`
              : rewriteState?.status === "error"
              ? `${styles.badge} ${styles.badgeError}`
              : styles.badge
          const persistedDraftTitle = item.activeOutlineDraftId
            ? item.outlineDrafts.find((d) => d.id === item.activeOutlineDraftId)?.title ?? null
            : null
          const subtitleSource = rewriteState?.result?.new_title ?? live?.title ?? persistedDraftTitle ?? item.outlineText
          const subtitle = subtitleSource.replaceAll("\n", " ").trim().slice(0, 42)
          return (
            <div key={item.sequence} className={styles.outlineNavItemWrap}>
              <Link href={href} className={isActive ? styles.outlineNavItemActive : styles.outlineNavItem}>
                <div className={styles.outlineNavItemTitleRow}>
                  <div className={styles.outlineNavItemTitle}>剧本大纲 {item.sequence}</div>
                  {badgeText ? <span className={badgeClass}>{badgeText}</span> : null}
                </div>
                <div className={styles.outlineNavItemSub}>{subtitle || "（无摘要）"}</div>
              </Link>
              <button
                type="button"
                className={styles.outlineNavRemove}
                aria-label="删除该大纲章节"
                title="删除"
                disabled={Boolean(deletingOutlineId)}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirmDeleteOutlineId(item.outlineId)
                }}
              >
                —
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
