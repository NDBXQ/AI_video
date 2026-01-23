import type { ReactNode } from "react"
import styles from "./TimelineTrack.module.css"

interface TimelineTrackProps {
  label: string
  children: ReactNode
}

export function TimelineTrack({ label, children }: TimelineTrackProps) {
  return (
    <div className={styles.track}>
      <div className={styles.trackLabel}>{label}</div>
      <div className={styles.trackLane}>{children}</div>
    </div>
  )
}
