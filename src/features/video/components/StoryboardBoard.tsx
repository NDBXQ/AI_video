import { useMemo, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import type { StoryboardItem } from "@/features/video/types"
import styles from "./StoryboardBoard.module.css"
import sidebarStyles from "./StoryboardList/StoryboardSidebar.module.css"
import toolbarStyles from "./StoryboardList/StoryboardToolbar.module.css"
import { useStoryboardData } from "../hooks/useStoryboardData"

type StoryboardBoardProps = {
  initialItems?: StoryboardItem[]
  onGoToList?: () => void
  storyId?: string
  outlineId?: string
}

type DragState = { draggingId: string | null }

function buildCardText(item: StoryboardItem): string {
  const hasScriptView =
    Boolean(item.shot_content.background.background_name) ||
    item.shot_content.roles.length > 0 ||
    Boolean(item.shot_content.bgm)
  if (!hasScriptView) return item.storyboard_text?.trim() ?? ""

  const firstRole = item.shot_content.roles[0]
  const speak = item.shot_content.roles.find((r) => r.speak?.content)?.speak?.content
  const parts = [
    `场景：${item.shot_content.background.background_name}（${item.shot_content.background.status}）`,
    firstRole ? `角色：${firstRole.role_name}，动作：${firstRole.action}` : "",
    speak ? `台词：“${speak}”` : "",
    item.shot_content.bgm ? `BGM：${item.shot_content.bgm}` : ""
  ].filter(Boolean)
  return parts.join("\n")
}

function IconGrip(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCopy(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 8h10v10H8V8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrash(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StoryboardBoard({
  initialItems = [],
  onGoToList,
  storyId: initialStoryId,
  outlineId: initialOutlineId
}: StoryboardBoardProps): ReactElement {
  const router = useRouter()
  const { items, setItems, episodes, activeEpisode, reloadShots, storyId, isLoading, loadError } = useStoryboardData({
    initialItems,
    storyId: initialStoryId,
    outlineId: initialOutlineId
  })
  const [drag, setDrag] = useState<DragState>({ draggingId: null })

  const safeActiveEpisode = useMemo(() => {
    if (activeEpisode) return activeEpisode
    return episodes[0]?.id ?? ""
  }, [activeEpisode, episodes])

  const handleCopy = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id)
      if (idx < 0) return prev
      const origin = prev[idx]
      const newId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const copy: StoryboardItem = {
        ...origin,
        id: newId,
        scene_no: prev.length + 1
      }
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
      return next.map((it, i) => ({ ...it, scene_no: i + 1 }))
    })
  }

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id).map((it, i) => ({ ...it, scene_no: i + 1 })))
  }

  const handleDragStart = (id: string) => {
    setDrag({ draggingId: id })
  }

  const handleDropOn = (targetId: string) => {
    setItems((prev) => {
      const fromId = drag.draggingId
      if (!fromId || fromId === targetId) return prev
      const fromIndex = prev.findIndex((it) => it.id === fromId)
      const toIndex = prev.findIndex((it) => it.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next.map((it, i) => ({ ...it, scene_no: i + 1 }))
    })
    setDrag({ draggingId: null })
  }

  return (
    <section className={styles.board} aria-label="分镜故事板">
      <div className={styles.content}>
        <aside className={sidebarStyles.sidebar} aria-label="剧集列表">
          <div className={sidebarStyles.sidebarHeader}>
            {onGoToList ? (
              <button type="button" className={sidebarStyles.backButton} onClick={onGoToList} aria-label="返回分镜表">
                ←
              </button>
            ) : null}
            <span>剧集列表</span>
          </div>
          <div className={sidebarStyles.episodeList}>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                className={`${sidebarStyles.episodeItem} ${safeActiveEpisode === ep.id ? sidebarStyles.episodeActive : ""}`}
                onClick={() => reloadShots(ep.id)}
              >
                <span>{ep.name}</span>
                <span
                  className={`${sidebarStyles.statusBadge} ${ep.status === "completed" ? sidebarStyles.statusCompleted : sidebarStyles.statusProcessing}`}
                >
                  {ep.status === "completed" ? "已完成" : "生成中"}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.main} aria-label="分镜卡片区">
          <div className={toolbarStyles.toolbar}>
            <div className={toolbarStyles.toolbarLeft}>
              <h2 className={toolbarStyles.toolbarTitle}>分镜脚本</h2>
              <span className={toolbarStyles.toolbarMeta}>共 {items.length} 个镜头</span>
            </div>
            <div className={toolbarStyles.toolbarActions}>
              <button className={`${toolbarStyles.btn} ${toolbarStyles.btnPrimary}`}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                AI 生成脚本
              </button>
            </div>
          </div>
          <div className={styles.mainInner}>
            {isLoading ? <div className={styles.empty}>加载中…</div> : null}
            {!isLoading && loadError ? <div className={styles.empty}>{loadError}</div> : null}
            <div className={styles.grid}>
            {items.map((it) => {
              const isDragging = drag.draggingId === it.id
              const disabled = false
              const handleGoToImage = () => {
                const qs = new URLSearchParams({ storyboardId: it.id })
                if (storyId) qs.set("storyId", storyId)
                if (safeActiveEpisode) qs.set("outlineId", safeActiveEpisode)
                router.push(`/video/image?${qs.toString()}`)
              }
              const handleGoToVideo = () => {
                const qs = new URLSearchParams({ storyboardId: it.id })
                if (storyId) qs.set("storyId", storyId)
                if (safeActiveEpisode) qs.set("outlineId", safeActiveEpisode)
                router.push(`/video/video?${qs.toString()}`)
              }
              return (
                <article
                  key={it.id}
                  className={styles.card}
                  draggable
                  onDragStart={() => handleDragStart(it.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOn(it.id)}
                  style={isDragging ? { opacity: 0.65 } : undefined}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>镜 {it.scene_no}</div>
                    <div className={styles.iconGroup}>
                      <button type="button" className={styles.iconBtn} aria-label="拖拽排序" title="拖拽排序">
                        <IconGrip />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="复制镜头"
                        title="复制"
                        onClick={() => handleCopy(it.id)}
                      >
                        <IconCopy />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="删除镜头"
                        title="删除"
                        onClick={() => handleDelete(it.id)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  <div className={styles.preview}>画面预览</div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardText}>{buildCardText(it)}</div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${disabled ? styles.actionBtnDisabled : ""}`}
                      disabled={disabled}
                      onClick={handleGoToImage}
                    >
                      生成图片
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${disabled ? styles.actionBtnDisabled : ""}`}
                      disabled={disabled}
                      onClick={handleGoToVideo}
                    >
                      生成视频
                    </button>
                  </div>
                </article>
              )
            })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
