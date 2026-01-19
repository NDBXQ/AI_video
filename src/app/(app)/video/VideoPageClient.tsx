"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { StoryboardList } from "@/features/video/components/StoryboardList"
import { StoryboardBoard } from "@/features/video/components/StoryboardBoard"
import styles from "./page.module.css"

type Tab = "list" | "board"

export function VideoPageClient({ initialTab }: { initialTab: Tab }): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlTab = useMemo<Tab>(() => {
    const raw = searchParams.get("tab")
    return raw === "board" ? "board" : "list"
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useEffect(() => {
    setActiveTab(urlTab)
  }, [urlTab])

  return (
    <main className={styles.container}>
      <div className={styles.headerCard}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "list" ? styles.activeTab : ""}`}
            onClick={() => {
              setActiveTab("list")
              router.push("/video?tab=list")
            }}
          >
            分镜表
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "board" ? styles.activeTab : ""}`}
            onClick={() => {
              setActiveTab("board")
              router.push("/video?tab=board")
            }}
          >
            分镜故事板
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {activeTab === "list" ? <StoryboardList /> : <StoryboardBoard />}
      </div>
    </main>
  )
}
