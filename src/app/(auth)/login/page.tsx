import { LoginForm } from "@/features/auth/LoginForm"
import styles from "./page.module.css"
import type { ReactElement } from "react"
import { Suspense } from "react"
import Link from "next/link"
import { HelpCircle, Sparkles, BookOpenText, Layers3, Zap } from "lucide-react"

/**
 * 登录页
 * @returns {ReactElement} 页面内容
 */
export default function LoginPage(): ReactElement {
  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.topInner}>
          <Link href="/login" className={styles.brand} aria-label="AI视频创作平台">
            <span className={styles.brandIcon} aria-hidden="true" />
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>AI视频创作平台</span>
              <span className={styles.brandSubtitle}>AI VIDEO CREATOR</span>
            </span>
          </Link>

          <Link href="/help" className={styles.helpLink}>
            <HelpCircle size={16} />
            帮助
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.left} aria-label="产品介绍">
        <div className={styles.badge}>
          <span className={styles.badgeIcon} aria-hidden="true" />
          从故事到成片，效率提升一个数量级
        </div>

        <h1 className={styles.title}>
          AI 视频创作
          <span className={styles.titleAccent}>让灵感秒变作品</span>
        </h1>

        <p className={styles.subtitle}>
          自动分镜、AI 出图、快速合成。把“想法”变成“可发布”的短视频工作流，集中在一个地方完成。
        </p>

        <div className={styles.chips} aria-label="能力标签">
          <div className={styles.chip}>
            <span className={styles.chipIcon} aria-hidden="true" />
            可上传参考图
          </div>
          <div className={styles.chip}>
            <span className={styles.chipIcon} aria-hidden="true" />
            内容库统一管理
          </div>
          <div className={styles.chip}>
            <span className={styles.chipIcon} aria-hidden="true" />
            脚本到成片闭环
          </div>
        </div>

        <div className={styles.steps} aria-label="三步完成">
          <div className={styles.stepCard}>
            <div className={styles.stepTop}>
              <div className={styles.stepIcon} aria-hidden="true">
                <BookOpenText size={18} />
              </div>
              <div className={styles.stepNo}>01</div>
            </div>
            <div className={styles.stepTitle}>输入故事</div>
            <div className={styles.stepDesc}>粘贴原文或写个梗概，快速开始</div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepTop}>
              <div className={styles.stepIcon} aria-hidden="true">
                <Layers3 size={18} />
              </div>
              <div className={styles.stepNo}>02</div>
            </div>
            <div className={styles.stepTitle}>生成分镜</div>
            <div className={styles.stepDesc}>自动拆镜头、出脚本、补细节</div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepTop}>
              <div className={styles.stepIcon} aria-hidden="true">
                <Zap size={18} />
              </div>
              <div className={styles.stepNo}>03</div>
            </div>
            <div className={styles.stepTitle}>一键合成</div>
            <div className={styles.stepDesc}>出图、配音、合成，快速成片</div>
          </div>
        </div>

        <div className={styles.ctaRow} aria-label="快捷入口">
          <Link className={styles.ctaPrimary} href="/login?next=/script">
            先看看脚本创作 →
          </Link>
          <Link className={styles.ctaSecondary} href="/login?next=/video">
            直接去视频创作 →
          </Link>
        </div>
      </section>

      <section className={styles.right} aria-label="登录面板">
        <div className={styles.panel}>
          <div className={styles.panelTop}>
            <div>
              <div className={styles.panelTitle}>欢迎回来</div>
              <div className={styles.panelHint}>体验完整版：用户名/密码可随意输入</div>
            </div>
            <div className={styles.panelIconBtn} aria-hidden="true">
              <Sparkles size={18} />
            </div>
          </div>

          <Suspense fallback={null}>
            <LoginForm variant="plain" buttonLabel="登录进入工作台 →" />
          </Suspense>

          <div className={styles.divider}>第三方登录</div>
          <div className={styles.thirdParty}>
            <div className={styles.thirdCard}>
              推荐流程：先做「脚本创作」生成分镜脚本，再进入「视频创作」合成视频。
            </div>
          </div>

          <div className={styles.bottomText}>
            还没有账号？<Link className={styles.bottomLink} href="/login">立即注册</Link>
          </div>
        </div>
      </section>
      </main>
    </div>
  )
}
