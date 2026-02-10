"use client"

import type { ReactElement } from "react"
import { useEffect, useId, useRef, useState } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"
import styles from "./StoryContentModal.module.css"
import { fetchAllImages, fetchAllStoryboards, fetchAudiosByStoryboardIds, fetchStoryDetail } from "./storyContentApi"
import type { GeneratedAudio, GeneratedImage, Outline, Shot, StoryDetail } from "./storyContentTypes"
import { StoryContentOverviewTab } from "./StoryContentOverviewTab"
import { StoryContentStoryboardsTab } from "./StoryContentStoryboardsTab"
import { StoryContentAssetsTab } from "./StoryContentAssetsTab"

type Props = {
  open: boolean
  storyId: string | null
  storyTitle?: string
  onClose: () => void
}

type TabKey = "overview" | "storyboards" | "assets"

export function StoryContentModal({ open, storyId, storyTitle, onClose }: Props): ReactElement | null {
  const [tab, setTab] = useState<TabKey>("overview")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [story, setStory] = useState<StoryDetail | null>(null)
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [shotsByOutlineId, setShotsByOutlineId] = useState<Record<string, Shot[]>>({})
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [audiosByStoryboardId, setAudiosByStoryboardId] = useState<Record<string, GeneratedAudio[]>>({})
  const canPortal = typeof document !== "undefined"
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const id = (storyId ?? "").trim()
    if (!id) return

    let cancelled = false
    setTab("overview")
    setLoading(true)
    setError("")
    setStory(null)
    setOutlines([])
    setShotsByOutlineId({})
    setImages([])
    setAudiosByStoryboardId({})

    ;(async () => {
      try {
        const detail = await fetchStoryDetail(id)
        if (cancelled) return
        setStory(detail)

        const { outlines: olist, shotsByOutlineId: by } = await fetchAllStoryboards(id)
        if (cancelled) return
        setOutlines(olist)
        setShotsByOutlineId(by)

        const imgs = await fetchAllImages(id)
        if (cancelled) return
        setImages(imgs)

        const allShotIds = Object.values(by).flatMap((s) => s.map((x) => x.id)).filter(Boolean)
        const audioMap = await fetchAudiosByStoryboardIds(allShotIds)
        if (cancelled) return
        setAudiosByStoryboardId(audioMap)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "加载失败")
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, storyId])

  const title = storyTitle || story?.title || "查看内容"

  useEffect(() => {
    if (!open || !storyId) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    modalRef.current?.focus()

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose, storyId])

  if (!open || !storyId) return null

  const content = (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="内容切换">
          <button
            type="button"
            className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
            onClick={() => setTab("overview")}
            role="tab"
            aria-selected={tab === "overview"}
          >
            概览
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "storyboards" ? styles.tabActive : ""}`}
            onClick={() => setTab("storyboards")}
            role="tab"
            aria-selected={tab === "storyboards"}
          >
            分镜
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "assets" ? styles.tabActive : ""}`}
            onClick={() => setTab("assets")}
            role="tab"
            aria-selected={tab === "assets"}
          >
            素材
          </button>
        </div>

        <div className={styles.body}>
          {loading ? <div className={styles.muted}>加载中...</div> : null}
          {error ? <div className={styles.muted}>{error}</div> : null}

          {!loading && !error && tab === "overview" ? <StoryContentOverviewTab story={story} outlines={outlines} /> : null}
          {!loading && !error && tab === "storyboards" ? (
            <StoryContentStoryboardsTab outlines={outlines} shotsByOutlineId={shotsByOutlineId} />
          ) : null}
          {!loading && !error && tab === "assets" ? (
            <StoryContentAssetsTab
              outlines={outlines}
              shotsByOutlineId={shotsByOutlineId}
              images={images}
              audiosByStoryboardId={audiosByStoryboardId}
            />
          ) : null}
        </div>
      </div>
    </div>
  )

  return canPortal ? createPortal(content, document.body) : content
}
