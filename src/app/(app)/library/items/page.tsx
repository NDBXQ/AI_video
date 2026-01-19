import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function ItemsLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>物品库</h1>
      <p className={styles.sectionDesc}>管理道具与可复用物品素材，支持整理与快速调用。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>后续可在此处维护物品素材，供脚本与视频创作快速引用。</p>
      </div>
    </div>
  )
}
