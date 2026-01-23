"use client"

import Image from "next/image"
import { useMemo, useState, type ReactElement } from "react"
import styles from "./TwoFrameImagePreview.module.css"

export type TwoFrameImagePreviewFrame = {
  label: string
  src: string
}

export function TwoFrameImagePreview({
  title,
  frames,
  onImageLoad
}: {
  title: string
  frames: [TwoFrameImagePreviewFrame, TwoFrameImagePreviewFrame]
  onImageLoad?: (img: { naturalWidth: number; naturalHeight: number }) => void
}): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0)

  const active = frames[activeIndex] ?? frames[0]

  const canPrev = true
  const canNext = true

  const badgeText = useMemo(() => `${activeIndex + 1}/2`, [activeIndex])

  return (
    <div
      className={styles.root}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          setActiveIndex((v) => (v === 0 ? 1 : 0))
        }
        if (e.key === "ArrowRight") {
          e.preventDefault()
          setActiveIndex((v) => (v === 0 ? 1 : 0))
        }
      }}
      aria-label="首帧/尾帧预览"
    >
      <button
        type="button"
        className={`${styles.navBtn} ${styles.navBtnLeft}`}
        aria-label="切换到上一张"
        disabled={!canPrev}
        onClick={() => setActiveIndex((v) => (v === 0 ? 1 : 0))}
      >
        ‹
      </button>

      <button
        type="button"
        className={`${styles.navBtn} ${styles.navBtnRight}`}
        aria-label="切换到下一张"
        disabled={!canNext}
        onClick={() => setActiveIndex((v) => (v === 0 ? 1 : 0))}
      >
        ›
      </button>

      <button
        type="button"
        className={styles.badge}
        aria-label="切换首尾帧"
        onClick={() => setActiveIndex((v) => (v === 0 ? 1 : 0))}
      >
        <span className={styles.badgeLabel}>{active.label}</span>
        <span className={styles.badgeDivider} aria-hidden="true" />
        <span className={styles.badgeCount}>{badgeText}</span>
      </button>

      <Image
        src={active.src}
        alt={`${title} ${active.label}`}
        fill
        unoptimized
        sizes="(max-width: 1023px) 100vw, 980px"
        onLoadingComplete={(img) => {
          onImageLoad?.({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
        }}
      />
    </div>
  )
}
