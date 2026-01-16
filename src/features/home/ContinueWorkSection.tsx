import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./ContinueWorkSection.module.css"

/**
 * 继续创作区块（当前为默认空态）
 * @returns {ReactElement} 区块内容
 */
export function ContinueWorkSection(): ReactElement {
  return (
    <section className={styles.card} aria-label="继续创作">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon} aria-hidden="true" />
          <span className={styles.headerTitle}>继续创作</span>
          <span className={styles.headerHint}>最近项目会出现在这里</span>
        </div>
        <Link href="/library" className={styles.headerLink}>
          查看全部
        </Link>
      </div>

      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden="true" />
        <div className={styles.emptyTitle}>暂无最近项目</div>
        <div className={styles.emptySub}>
          从脚本/分镜开始，或者先去内容库准备素材
        </div>
        <div className={styles.buttons}>
          <Link href="/script" className={styles.primaryButton}>
            去生成分镜
          </Link>
          <Link href="/library" className={styles.secondaryButton}>
            打开内容库
          </Link>
        </div>
      </div>
    </section>
  )
}

