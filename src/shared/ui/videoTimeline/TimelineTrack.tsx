import type { ReactNode } from "react"
import styles from "./TimelineTrack.module.css"

interface TimelineTrackProps {
  label: string
  children: ReactNode
}

export function TimelineTrack({ label, children }: TimelineTrackProps) {
  const icon = (() => {
    const key = label.trim()
    if (key === "视频") {
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 10l5 2-5 2v-4z" fill="currentColor" />
        </svg>
      )
    }
    if (key === "音轨") {
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 10v4M10 8v8M14 11v2M18 7v10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    }
    return null
  })()

  return (
    <div className={styles.track}>
      <div className={styles.trackLabel} title={label} aria-label={label} data-track-label="true">
        <div
          className={styles.trackLabelInner}
          onWheel={(e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {icon ?? label}
        </div>
      </div>
      <div className={styles.trackLane}>{children}</div>
    </div>
  )
}

