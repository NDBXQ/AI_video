import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function GeneratedVideosLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>已生成的视频库</h1>
      <p className={styles.sectionDesc}>管理已生成成片与导出记录，便于查找、预览与下载。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>生成视频后会自动归档到这里，便于统一管理与回溯。</p>
      </div>
    </div>
  )
}
