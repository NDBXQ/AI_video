"use client"

import { Pause, Play, SlidersHorizontal } from "lucide-react"
import { useMemo, useState, type ReactElement } from "react"
import styles from "./TvcTimelinePanel.module.css"

export type TimelineShot = {
  id: string
  sequence: number
  storyboardText: string
  shotCut?: boolean
  frames?: {
    first?: { url?: string | null; thumbnailUrl?: string | null; prompt?: string | null }
    last?: { url?: string | null; thumbnailUrl?: string | null; prompt?: string | null }
  }
  videoInfo?: { url?: string | null }
  scriptContent?: unknown
}

export function TvcTimelinePanel({
  shots,
  selectedShotId,
  onSelectShot
}: {
  shots: TimelineShot[]
  selectedShotId?: string | null
  onSelectShot?: (id: string | null) => void
}): ReactElement {
  const [isPlaying, setIsPlaying] = useState(false)
  const clips = useMemo(() => shots, [shots])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>Timeline（占位）</div>
        <div className={styles.controls}>
          <button type="button" className={styles.controlBtn} onClick={() => setIsPlaying((v) => !v)}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className={styles.controlBtn} disabled>
            <SlidersHorizontal size={16} />
            Smooth
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.track} aria-label="视频片段轨道">
          <div className={styles.clips}>
            {clips.length === 0 ? (
              <div className={styles.empty}>暂无分镜片段</div>
            ) : (
              clips.map((c) => {
                const active = selectedShotId === c.id
                const label = String(c.sequence).padStart(2, "0")
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.clipBtn} ${active ? styles.clipBtnActive : ""}`}
                    onClick={() => onSelectShot?.(c.id)}
                    title={`Shot ${label}`}
                  >
                    <div className={styles.clipTop}>
                      <div className={styles.clipLabel}>Shot {label}</div>
                      {c.shotCut ? <div className={styles.clipCut}>Cut</div> : null}
                    </div>
                    <div className={styles.clipMeta}>
                      {c.videoInfo?.url ? <span className={styles.clipPill}>Video</span> : null}
                      {c.frames?.first?.url ? <span className={styles.clipPill}>Img</span> : null}
                      {c.scriptContent ? <span className={styles.clipPill}>Script</span> : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className={styles.wave} aria-label="音频波形轨道">
          <div className={styles.waveBar} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
