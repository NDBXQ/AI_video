import styles from "./page.module.css"
import type { ReactElement } from "react"
import Link from "next/link"

/**
 * 首页
 * @returns {ReactElement} 首页内容
 */
export default function HomePage(): ReactElement {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>ai-video</h1>
      <p className={styles.subtitle}>Next.js App Router 初始化完成</p>
      <p className={styles.subtitle}>
        <Link href="/login">去登录页</Link>
      </p>
    </main>
  )
}
