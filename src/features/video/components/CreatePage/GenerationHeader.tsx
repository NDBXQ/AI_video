import { type ReactElement } from "react"
import styles from "./GenerationHeader.module.css"

type Props = {
  onBack: () => void
  activeTab: "image" | "video"
  onTabChange: (tab: "image" | "video") => void
  sceneNo: number
  info: { label: string; value: string }[]
}

export function GenerationHeader({ onBack, activeTab, onTabChange, sceneNo, info }: Props): ReactElement {
  return (
    <header className={styles.topBar}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        返回
      </button>
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
        <span>镜号：{sceneNo}</span>
        {info.map((it) => (
          <span key={it.label}>
            {it.label}：{it.value}
          </span>
        ))}
      </div>
    </header>
  )
}
