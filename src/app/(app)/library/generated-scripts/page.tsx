import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function GeneratedScriptsLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>已生成的脚本库</h1>
      <p className={styles.sectionDesc}>汇总已生成脚本，支持查看、复用与后续二次编辑。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>生成脚本后会自动归档到这里，方便检索与复用。</p>
      </div>
    </div>
  )
}
