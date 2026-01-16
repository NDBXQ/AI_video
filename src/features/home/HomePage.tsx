import type { ReactElement } from "react"
import styles from "./HomePage.module.css"
import { WorkbenchHero } from "@/features/home/WorkbenchHero"
import { ContinueWorkSection } from "@/features/home/ContinueWorkSection"
import { FeatureCards } from "@/features/home/FeatureCards"

/**
 * 首页内容（工作台）
 * @returns {ReactElement} 页面内容
 */
export function HomePage(): ReactElement {
  return (
    <main className={styles.main}>
      <WorkbenchHero />
      <ContinueWorkSection />
      <FeatureCards />
    </main>
  )
}

