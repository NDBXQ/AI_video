import Link from "next/link"
import type { ReactElement } from "react"
import styles from "../placeholder.module.css"

/**
 * 视频创作占位页
 * @returns {ReactElement} 页面内容
 */
export default function VideoPage(): ReactElement {
  return (
    <main className={styles.card}>
      <h1 className={styles.title}>视频创作</h1>
      <p className={styles.desc}>这里将提供素材生成、合成与预览能力。</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/">
          返回首页
        </Link>
        <Link className={styles.secondary} href="/library">
          打开内容库
        </Link>
      </div>
    </main>
  )
}

