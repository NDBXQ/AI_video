"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import { X } from "lucide-react"
import styles from "./StoryOriginalContentModal.module.css"
import { getStoryOriginalContent } from "../actions/library"

interface StoryOriginalContentModalProps {
  open: boolean
  storyId: string | null
  onClose: () => void
}

type StoryOriginalData = { title: string; intro?: string; originalText: string }

export function StoryOriginalContentModal({
  open,
  storyId,
  onClose
}: StoryOriginalContentModalProps): ReactElement | null {
  const [result, setResult] = useState<{ storyId: string; data: StoryOriginalData } | null>(null)
  const [error, setError] = useState<{ storyId: string; message: string } | null>(null)

  useEffect(() => {
    if (!open || !storyId) return
    let cancelled = false

    getStoryOriginalContent(storyId)
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          setError({ storyId, message: res.message || "加载失败" })
          return
        }
        setResult({
          storyId,
          data: { title: res.data.title, intro: res.data.intro, originalText: res.data.originalText }
        })
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError({ storyId, message: e instanceof Error ? e.message : "加载失败" })
      })

    return () => {
      cancelled = true
    }
  }, [open, storyId])

  const view = useMemo(() => {
    const data = storyId && result?.storyId === storyId ? result.data : null
    const errorText = storyId && error?.storyId === storyId ? error.message : null
    const loading = Boolean(open && storyId && !data && !errorText)
    return { data, errorText, loading }
  }, [error, open, result, storyId])

  if (!open || !storyId) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{view.data?.title ?? "查看原始内容"}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {view.loading ? (
            <div className={styles.muted}>加载中...</div>
          ) : view.errorText ? (
            <div className={styles.muted}>{view.errorText}</div>
          ) : view.data ? (
            <>
              {view.data.intro ? (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>简介</div>
                  <div className={styles.sectionBody}>{view.data.intro}</div>
                </div>
              ) : null}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>原文内容</div>
                <div className={styles.sectionBody}>{view.data.originalText || "（空）"}</div>
              </div>
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btn} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  )
}

