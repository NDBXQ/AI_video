import Link from "next/link"
import type { ReactElement } from "react"
import styles from "../placeholder.module.css"

/**
 * 脚本创作占位页
 * @returns {ReactElement} 页面内容
 */
export default function ScriptPage(): ReactElement {
  return (
    <main className={styles.card}>
      <h1 className={styles.title}>脚本创作</h1>
      <p className={styles.desc}>这里将提供脚本/分镜的生成与编辑能力。</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/">
          返回首页
        </Link>
        <Link className={styles.secondary} href="/video">
          去视频创作
        </Link>
      </div>
    </main>
  )
}

