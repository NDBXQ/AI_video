import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./WorkbenchHero.module.css"

/**
 * 首页工作台引导区块
 * @returns {ReactElement} 区块内容
 */
export function WorkbenchHero(): ReactElement {
  return (
    <section className={styles.card} aria-label="工作台">
      <div className={styles.tag}>
        <span className={styles.tagIcon} aria-hidden="true" />
        工作台
      </div>

      <div className={styles.actions}>
        <Link href="/script" className={`${styles.actionCard} ${styles.primary}`}>
          <div className={styles.actionIcon} aria-hidden="true" />
          <div className={styles.actionText}>
            <div className={styles.actionTitle}>新建脚本 / 分镜</div>
            <div className={styles.actionSub}>从故事出发，生成分镜脚本</div>
          </div>
          <span className={styles.chevron} aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </section>
  )
}
