import Link from "next/link"
import type { ReactElement } from "react"
import styles from "../placeholder.module.css"

/**
 * 帮助中心占位页
 * @returns {ReactElement} 页面内容
 */
export default function HelpPage(): ReactElement {
  return (
    <main className={styles.card}>
      <h1 className={styles.title}>帮助中心</h1>
      <p className={styles.desc}>这里将提供使用指引、FAQ 与反馈入口。</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/">
          返回首页
        </Link>
        <Link className={styles.secondary} href="/login">
          去登录页
        </Link>
      </div>
    </main>
  )
}

