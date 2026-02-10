import { type ReactElement } from "react"
import styles from "./GenerationHeader.module.css"

type Props = {
  onBack: () => void
  activeTab: "image" | "video"
  onTabChange: (tab: "image" | "video") => void
  episodeLabel?: string | null
  sceneNo: number
  info: { label: string; value: string }[]
  recommendedStoryboardMode?: "首帧" | "首尾帧" | null
  canPrevScene?: boolean
  canNextScene?: boolean
  onPrevScene?: () => void
  onNextScene?: () => void
  mobileActions?: ReactElement | null
}

export function GenerationHeader({
  onBack,
  activeTab,
  onTabChange,
  episodeLabel,
  sceneNo,
  info,
  recommendedStoryboardMode,
  canPrevScene,
  canNextScene,
  onPrevScene,
  onNextScene,
  mobileActions
}: Props): ReactElement {
  return (
    <header className={styles.topBar}>
      <div className={styles.leftArea}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          返回
        </button>
        <span className={`${styles.modeBadge} ${styles.modePill}`} aria-label="推荐模式">
          推荐模式：{recommendedStoryboardMode ? `${recommendedStoryboardMode}` : "未生成"}
        </span>
      </div>
      <div className={styles.modeTabs} role="tablist" aria-label="生成类型切换">
        <button
          type="button"
          className={`${styles.modeTab} ${activeTab === "image" ? styles.modeTabActive : ""}`}
          onClick={() => {
            if (activeTab === "image") return
            onTabChange("image")
          }}
        >
          生成图片
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${activeTab === "video" ? styles.modeTabActive : ""}`}
          onClick={() => {
            if (activeTab === "video") return
            onTabChange("video")
          }}
        >
          生成视频
        </button>
      </div>
      <div className={styles.rightInfo}>
        {mobileActions ? <div className={styles.mobileOnly}>{mobileActions}</div> : null}
        <div className={styles.sceneNav}>
          <button
            type="button"
            className={`${styles.pill} ${styles.pillButton}`}
            onClick={onPrevScene}
            disabled={!onPrevScene || canPrevScene === false}
            aria-label="上一镜"
            title="上一镜"
          >
            上一镜
          </button>
          {episodeLabel ? <span className={styles.pill}>{episodeLabel}</span> : null}
          <span className={styles.pill}>镜号：{sceneNo}</span>
          <button
            type="button"
            className={`${styles.pill} ${styles.pillButton}`}
            onClick={onNextScene}
            disabled={!onNextScene || canNextScene === false}
            aria-label="下一镜"
            title="下一镜"
          >
            下一镜
          </button>
        </div>
        {info.map((it) => (
          <span key={it.label} className={`${styles.pill} ${styles.extraInfo}`}>
            {it.label}：{it.value}
          </span>
        ))}
      </div>
    </header>
  )
}
