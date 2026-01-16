import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./FeatureCards.module.css"

type FeatureCardProps = {
  title: string
  description: string
  bullets: string[]
  href: string
}

function FeatureCard({ title, description, bullets, href }: FeatureCardProps): ReactElement {
  return (
    <Link href={href} className={styles.card}>
      <div className={styles.top}>
        <div className={styles.icon} aria-hidden="true" />
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.desc}>{description}</div>
      <ul className={styles.list}>
        {bullets.map((b) => (
          <li key={b} className={styles.listItem}>
            {b}
          </li>
        ))}
      </ul>
      <div className={styles.footer}>立即开始 →</div>
    </Link>
  )
}

/**
 * 首页功能入口卡片（脚本创作/视频创作）
 * @returns {ReactElement} 区块内容
 */
export function FeatureCards(): ReactElement {
  return (
    <section className={styles.grid} aria-label="功能入口">
      <FeatureCard
        title="脚本创作"
        description="输入故事或主题，自动生成分镜脚本"
        bullets={["自动拆镜头与台词", "可迭代优化脚本细节", "与视频制作无缝衔接"]}
        href="/script"
      />
      <FeatureCard
        title="视频创作"
        description="基于分镜脚本生成素材并合成视频，支持上传素材"
        bullets={["AI 出图 + 参考图", "快速合成与预览", "生成结果统一入库"]}
        href="/video"
      />
    </section>
  )
}

