import type { ReactElement } from "react"
import styles from "./HomePage.module.css"
import { HomeWelcome } from "@/features/home/HomeWelcome"
import { HomeOnboardingSection } from "@/features/onboarding/HomeOnboardingSection"
import { ContinueWorkSection } from "@/features/home/ContinueWorkSection"
import { AnalyticsOverview } from "@/features/home/AnalyticsOverview"

/**
 * 首页内容（工作台）
 * @returns {ReactElement} 页面内容
 */
export function HomePage(): ReactElement {
  return (
    <main className={styles.main}>
      <div className={styles.welcome}>
        <HomeWelcome />
      </div>
      <div className={styles.onboarding}>
        <HomeOnboardingSection />
      </div>
      <div className={styles.continue}>
        <ContinueWorkSection />
      </div>
      <div className={styles.analytics}>
        <AnalyticsOverview />
      </div>
    </main>
  )
}
