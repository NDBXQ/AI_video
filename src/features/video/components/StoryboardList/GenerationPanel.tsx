"use client"

import { type ReactElement, useEffect, useId, useMemo, useRef } from "react"
import styles from "./GenerationPanel.module.css"

export type GenerationStepStatus = "pending" | "running" | "success" | "error"

export type GenerationStep = {
  key: string
  label: string
  status: GenerationStepStatus
  meta?: string
}

function getStatusText(status: GenerationStepStatus): string {
  if (status === "success") return "完成"
  if (status === "running") return "进行中"
  if (status === "error") return "失败"
  return "等待"
}

type GenerationPanelProps = {
  open: boolean
  title: string
  steps: GenerationStep[]
  episodeBars?: Array<{ id: string; label: string; percent: number; tone: GenerationStepStatus; meta?: string }>
  onToggleOpen: () => void
}

export function GenerationPanel({ open, title, steps, episodeBars, onToggleOpen }: GenerationPanelProps): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const uid = useId()
  const popoverId = `${uid}-generation-popover`

  const summary = useMemo(() => {
    const total = steps.length
    const success = steps.filter((s) => s.status === "success").length
    const hasError = steps.some((s) => s.status === "error")
    const running = steps.find((s) => s.status === "running")
    const percent = total > 0 ? Math.round((success / total) * 100) : 0
    const tone: "running" | "success" | "error" | "pending" = hasError
      ? "error"
      : success >= total && total > 0
        ? "success"
        : running
          ? "running"
          : "pending"
    const text = tone === "error" ? "失败" : tone === "success" ? "完成" : tone === "running" ? "进行中" : "等待"
    return { total, success, percent, tone, text }
  }, [steps])

  useEffect(() => {
    if (!open) return
    function handleDocumentMouseDown(ev: MouseEvent): void {
      const el = rootRef.current
      if (!el) return
      const target = ev.target
      if (!(target instanceof Node)) return
      if (el.contains(target)) return
      onToggleOpen()
    }
    function handleDocumentKeyDown(ev: KeyboardEvent): void {
      if (ev.key === "Escape") onToggleOpen()
    }

    document.addEventListener("mousedown", handleDocumentMouseDown)
    document.addEventListener("keydown", handleDocumentKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown)
      document.removeEventListener("keydown", handleDocumentKeyDown)
    }
  }, [open, onToggleOpen])

  return (
    <div className={styles.generationPanel} ref={rootRef}>
      <div className={styles.generationBar} aria-label="生成进度">
        <div className={styles.generationTitle}>
          <span className={styles.generationTitleIcon} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 12h5l2-4 2 8 2-6h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={styles.generationTitleText}>{title}</span>
        </div>

        <div className={styles.generationProgress} aria-label={`进度 ${summary.success}/${summary.total}`}>
          <div className={styles.generationProgressTrack}>
            <div
              className={`${styles.generationProgressFill} ${
                summary.tone === "success"
                  ? styles.generationProgressFillSuccess
                  : summary.tone === "error"
                    ? styles.generationProgressFillError
                    : summary.tone === "running"
                      ? styles.generationProgressFillRunning
                      : styles.generationProgressFillPending
              }`}
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </div>

        <div className={styles.generationSummary} aria-live="polite">
          <span
            className={`${styles.generationSummaryText} ${
              summary.tone === "success"
                ? styles.generationSummaryTextSuccess
                : summary.tone === "error"
                  ? styles.generationSummaryTextError
                  : summary.tone === "running"
                    ? styles.generationSummaryTextRunning
                    : styles.generationSummaryTextPending
            }`}
          >
            {summary.text}
          </span>
          <span className={styles.generationSummaryMeta}>
            {summary.success}/{summary.total}
          </span>
          <button
            type="button"
            className={styles.generationDetailsBtn}
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={onToggleOpen}
          >
            {open ? "收起" : "详情"}
          </button>
        </div>
      </div>

      {open ? (
        <div id={popoverId} className={styles.generationPopover} role="dialog" aria-label="生成详情" tabIndex={-1}>
          <div className={styles.generationPopoverHeader}>
            <div className={styles.generationPopoverTitle}>生成详情</div>
            <button
              type="button"
              className={styles.generationPopoverClose}
              aria-label="关闭生成详情"
              onClick={onToggleOpen}
            >
              ×
            </button>
          </div>
          <div className={styles.generationPopoverBody}>
            {episodeBars && episodeBars.length > 0 ? (
              <div className={styles.episodeProgressList} aria-label="按剧集进度">
                {episodeBars.map((ep) => (
                  <div key={ep.id} className={styles.episodeProgressRow}>
                    <div className={styles.episodeProgressLabel}>{ep.label}</div>
                    <div className={styles.episodeProgressBar}>
                      <div className={styles.generationProgressTrack}>
                        <div
                          className={`${styles.generationProgressFill} ${
                            ep.tone === "success"
                              ? styles.generationProgressFillSuccess
                              : ep.tone === "error"
                                ? styles.generationProgressFillError
                                : ep.tone === "running"
                                  ? styles.generationProgressFillRunning
                                  : styles.generationProgressFillPending
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, ep.percent))}%` }}
                        />
                      </div>
                    </div>
                    <div className={styles.episodeProgressMeta}>{ep.meta ?? `${ep.percent}%`}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {steps.map((step) => (
              <div key={step.key} className={styles.generationRow}>
                <span
                  className={`${styles.generationBadge} ${
                    step.status === "success"
                      ? styles.generationBadgeSuccess
                      : step.status === "running"
                        ? styles.generationBadgeRunning
                        : step.status === "error"
                          ? styles.generationBadgeError
                          : styles.generationBadgePending
                  }`}
                >
                  {getStatusText(step.status)}
                </span>
                <div className={styles.generationLabel}>{step.label}</div>
                {step.meta ? <div className={styles.generationMeta}>{step.meta}</div> : <div className={styles.generationMeta} />}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
