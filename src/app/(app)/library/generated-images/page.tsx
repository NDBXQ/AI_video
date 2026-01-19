import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function GeneratedImagesLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>已生成的图片库</h1>
      <p className={styles.sectionDesc}>汇总已生成图片资源，便于快速检索与复用。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>生成图片后会自动归档到这里，便于筛选与复用。</p>
      </div>
    </div>
  )
}
