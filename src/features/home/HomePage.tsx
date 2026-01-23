import type { ReactElement } from "react"
import styles from "./HomePage.module.css"
import { HomeWelcome } from "@/features/home/HomeWelcome"
import { WorkbenchHero } from "@/features/home/WorkbenchHero"
import { ContinueWorkSection } from "@/features/home/ContinueWorkSection"
import { AnalyticsOverview } from "@/features/home/AnalyticsOverview"

/**
 * 首页内容（工作台）
 * @returns {ReactElement} 页面内容
 */
export function HomePage(): ReactElement {
  return (
    <main className={styles.main}>
      <div className={styles.fullRow}>
        <HomeWelcome />
      </div>
      <WorkbenchHero />
      <ContinueWorkSection />
      <div className={styles.fullRow}>
        <AnalyticsOverview />
      </div>
    </main>
  )
}
