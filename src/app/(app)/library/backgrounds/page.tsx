import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function BackgroundsLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>背景库</h1>
      <p className={styles.sectionDesc}>管理场景背景资源，按主题与用途归档，便于检索与复用。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>后续可在此处导入/生成背景素材并进行分类管理。</p>
      </div>
    </div>
  )
}
