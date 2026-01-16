import Link from "next/link"
import type { ReactElement } from "react"
import styles from "../placeholder.module.css"

/**
 * 内容库占位页
 * @returns {ReactElement} 页面内容
 */
export default function LibraryPage(): ReactElement {
  return (
    <main className={styles.card}>
      <h1 className={styles.title}>内容库</h1>
      <p className={styles.desc}>这里将管理素材、成片与项目资源。</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/">
          返回首页
        </Link>
        <Link className={styles.secondary} href="/script">
          去脚本创作
        </Link>
      </div>
    </main>
  )
}

