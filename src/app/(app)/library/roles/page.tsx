import type { ReactElement } from "react"
import styles from "../LibraryLayout.module.css"

export default function RolesLibraryPage(): ReactElement {
  return (
    <div>
      <h1 className={styles.sectionTitle}>角色库</h1>
      <p className={styles.sectionDesc}>管理角色形象、名称与性格设定等素材，便于在脚本/视频创作中复用。</p>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>暂无内容</div>
        <p className={styles.emptyDesc}>后续可在此处新增、编辑与复用角色素材。</p>
      </div>
    </div>
  )
}
