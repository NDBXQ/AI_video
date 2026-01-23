import { type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import type { Episode, ApiOutline } from "../../types"
import { OutlineHint } from "../OutlineHint"
import styles from "./StoryboardSidebar.module.css"
import { buildOutlineTooltipText } from "../../utils/storyboardUtils"

type StoryboardSidebarProps = {
  episodes: Episode[]
  activeEpisode: string
  outlineById: Record<string, ApiOutline>
  storyId?: string
  onEpisodeClick: (id: string, options?: { force?: boolean }) => void
  isBusy?: boolean
}

export function StoryboardSidebar({ episodes, activeEpisode, outlineById, storyId, onEpisodeClick, isBusy }: StoryboardSidebarProps): ReactElement {
  const router = useRouter()

  const handleBackToScript = () => {
    if (storyId) {
      router.push(`/script/workspace/${storyId}`)
    }
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        {storyId ? (
          <button 
            type="button" 
            className={styles.backButton}
            onClick={handleBackToScript}
            title="返回剧本编辑"
          >
            <ArrowLeft size={16} />
          </button>
        ) : null}
        剧集列表
      </div>
      <div className={styles.episodeList}>
        {episodes.map((ep) => (
          <div
            key={ep.id}
            className={`${styles.episodeItem} ${activeEpisode === ep.id ? styles.episodeActive : ""} ${isBusy ? styles.episodeDisabled : ""}`}
            onClick={() => {
              if (isBusy) return
              onEpisodeClick(ep.id, { force: activeEpisode === ep.id })
            }}
          >
            <div className={styles.episodeLeft}>
              <span>{ep.name}</span>
              {outlineById[ep.id] ? (
                <OutlineHint
                  ariaLabel="查看大纲章节内容"
                  text={buildOutlineTooltipText(outlineById[ep.id])}
                />
              ) : null}
            </div>
            <span className={`${styles.statusBadge} ${ep.status === "completed" ? styles.statusCompleted : styles.statusProcessing}`}>
              {ep.status === "completed" ? "已完成" : ep.status === "processing" ? "生成中" : "未生成"}
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}
