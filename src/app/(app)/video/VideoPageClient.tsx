"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { StoryboardList } from "@/features/video/components/StoryboardList"
import { StoryboardBoard } from "@/features/video/components/StoryboardBoard"
import styles from "./page.module.css"

type Tab = "list" | "board"

export function VideoPageClient({
  initialTab,
  initialStoryId,
  initialOutlineId
}: {
  initialTab: Tab
  initialStoryId?: string
  initialOutlineId?: string
}): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlTab = useMemo<Tab>(() => {
    const raw = searchParams.get("tab")
    return raw === "board" ? "board" : "list"
  }, [searchParams])

  const urlStoryId = useMemo(() => searchParams.get("storyId") ?? initialStoryId ?? "", [initialStoryId, searchParams])
  const urlOutlineId = useMemo(
    () => searchParams.get("outlineId") ?? initialOutlineId ?? "",
    [initialOutlineId, searchParams]
  )
  const autoGenerate = searchParams.get("autoGenerate") === "true"

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useEffect(() => {
    setActiveTab(urlTab)
  }, [urlTab])

  return (
    <main className={styles.container}>
      <div className={`${styles.headerCard} ${styles.headerCardCompact}`}>
        <div className={`${styles.headerLeft} ${styles.headerLeftCompact}`}>
          <div className={`${styles.headerTag} ${styles.headerTagCompact}`}>视频创作</div>
          <div className={`${styles.headerTitle} ${styles.headerTitleCompact}`}>分镜管理</div>
          <div className={styles.headerSubtitle}>先在分镜表整理镜头与素材，再进入生图/生视频工作台。</div>
        </div>
        <div className={`${styles.tabs} ${styles.tabsCompact}`}>
          <button
            type="button"
            className={`${styles.tab} ${styles.tabCompact} ${activeTab === "list" ? styles.activeTab : ""}`}
            onClick={() => {
              setActiveTab("list")
              const qs = new URLSearchParams({ tab: "list" })
              if (urlStoryId) qs.set("storyId", urlStoryId)
              if (urlOutlineId) qs.set("outlineId", urlOutlineId)
              router.push(`/video?${qs.toString()}`)
            }}
          >
            分镜表
          </button>
          <button
            type="button"
            className={`${styles.tab} ${styles.tabCompact} ${activeTab === "board" ? styles.activeTab : ""}`}
            onClick={() => {
              setActiveTab("board")
              const qs = new URLSearchParams({ tab: "board" })
              if (urlStoryId) qs.set("storyId", urlStoryId)
              if (urlOutlineId) qs.set("outlineId", urlOutlineId)
              router.push(`/video?${qs.toString()}`)
            }}
          >
            分镜故事板
          </button>
        </div>
      </div>

      <div className={`${styles.contentCard} ${styles.contentCardCompact}`}>
        {activeTab === "list" ? (
          <StoryboardList
            storyId={urlStoryId || undefined}
            outlineId={urlOutlineId || undefined}
            autoGenerate={autoGenerate}
          />
        ) : (
          <StoryboardBoard
            storyId={urlStoryId || undefined}
            outlineId={urlOutlineId || undefined}
            onGoToList={() => {
              setActiveTab("list")
              const qs = new URLSearchParams({ tab: "list" })
              if (urlStoryId) qs.set("storyId", urlStoryId)
              if (urlOutlineId) qs.set("outlineId", urlOutlineId)
              router.push(`/video?${qs.toString()}`)
            }}
          />
        )}
      </div>
    </main>
  )
}
