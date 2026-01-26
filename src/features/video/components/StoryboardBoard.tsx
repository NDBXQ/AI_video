import { useMemo, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import type { StoryboardItem } from "@/features/video/types"
import styles from "./StoryboardBoard.module.css"
import sidebarStyles from "./StoryboardList/StoryboardSidebar.module.css"
import toolbarStyles from "./StoryboardList/StoryboardToolbar.module.css"
import { useStoryboardData } from "../hooks/useStoryboardData"
import { createLocalPreviewSvg } from "../utils/previewUtils"

type StoryboardBoardProps = {
  initialItems?: StoryboardItem[]
  onGoToList?: () => void
  storyId?: string
  outlineId?: string
}

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

  const safeActiveEpisode = useMemo(() => {
    if (activeEpisode) return activeEpisode
    return episodes[0]?.id ?? ""
  }, [activeEpisode, episodes])

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id).map((it, i) => ({ ...it, scene_no: i + 1 })))
  }

  return (
    <section className={styles.board} aria-label="分镜故事板">
      <div className={styles.content}>
        <aside className={sidebarStyles.sidebar} aria-label="剧集列表">
          <div className={sidebarStyles.sidebarHeader}>
            {onGoToList ? (
              <button
                type="button"
                className={sidebarStyles.backButton}
                onClick={onGoToList}
                aria-label="返回分镜表"
                title="返回分镜表"
              >
                <ArrowLeft size={16} />
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
          <div className={styles.mainWrap}>
            <div className={toolbarStyles.toolbar}>
              <div className={toolbarStyles.toolbarLeft}>
                <h2 className={toolbarStyles.toolbarTitle}>分镜脚本</h2>
                <span className={toolbarStyles.toolbarMeta}>共 {items.length} 个镜头</span>
              </div>
            </div>

            <div className={styles.mainInner}>
              {isLoading ? <div className={styles.empty}>加载中…</div> : null}
              {!isLoading && loadError ? <div className={styles.empty}>{loadError}</div> : null}
              <div className={styles.grid}>
                {items.map((it) => {
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
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>镜 {it.scene_no}</div>
                        <div className={styles.iconGroup}>
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

                      <div className={styles.preview} aria-label={`镜 ${it.scene_no} 首帧预览`}>
                        <img
                          className={styles.previewImg}
                          src={
                            ((it.frames?.first?.thumbnailUrl ?? "").trim() || (it.frames?.first?.url ?? "").trim()) ||
                            createLocalPreviewSvg(`镜 ${it.scene_no} / 未生成`)
                          }
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

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
      </div>
    </section>
  )
}
