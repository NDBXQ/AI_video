import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./HomeWelcome.module.css"

/**
 * 首页欢迎区块（静态文案）
 * @returns {ReactElement} 区块内容
 */
export function HomeWelcome(): ReactElement {
  return (
    <section className={styles.card} aria-label="欢迎">
      <div className={styles.left}>
        <div className={styles.kicker}>
          <span className={styles.kickerIcon} aria-hidden="true" />
          工作台概览
        </div>
        <div className={styles.title}>今天从哪里开始创作？</div>
        <div className={styles.subtitle}>
          推荐：先从剧本创作生成分镜脚本，再进入视频创作合成成片。流程更顺畅，结果更稳定。
        </div>
        <div className={styles.chips} aria-label="快捷提示">
          <span className={styles.chip}>支持参考图</span>
          <span className={styles.chip}>内容库统一管理</span>
          <span className={styles.chip}>生成结果可追溯</span>
        </div>
      </div>

      <div className={styles.right} aria-label="快捷入口">
        <Link href="/script/workspace?entry=nav" className={styles.primary}>
          新建剧本 →
        </Link>
        <div className={styles.secondaryRow}>
          <Link href="/library" className={styles.secondary}>
            打开内容库
          </Link>
          <Link href="/help" className={styles.secondary}>
            查看帮助
          </Link>
        </div>
        <div className={styles.hint}>你也可以先去内容库准备素材，再回到工作台继续。</div>
      </div>
    </section>
  )
}
