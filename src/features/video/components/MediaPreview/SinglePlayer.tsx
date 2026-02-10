import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./VideoPlayer.module.css"
import { TwoFrameImagePreview } from "../CreatePage/TwoFrameImagePreview"
import { createLocalPreviewSvg } from "@/shared/utils/previewUtils"
import type { TimelineVideoClip } from "@/shared/utils/mediaPreviewUtils"

export function SinglePlayer({
  isVideoTab,
  activeImageSrc,
  activeFrameImages,
  activeTitle,
  onOpenFrameImage,
  resolvedVideoSrc,
  resolvedIsVideoFile,
  activeVideoClip,
  disableClipConstraint,
  onMediaAspect
}: {
  isVideoTab: boolean
  activeImageSrc: string
  activeFrameImages?: { first?: string | null; last?: string | null }
  activeTitle: string
  onOpenFrameImage?: (frame: { label: string; src: string }) => void
  resolvedVideoSrc: string
  resolvedIsVideoFile: boolean
  activeVideoClip?: TimelineVideoClip | null
  disableClipConstraint?: boolean
  onMediaAspect: (ar: string) => void
}): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bufferingRetryRef = useRef<number | null>(null)
  const [buffering, setBuffering] = useState(false)

  const clearBufferingRetry = () => {
    if (bufferingRetryRef.current) {
      window.clearTimeout(bufferingRetryRef.current)
      bufferingRetryRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearBufferingRetry()
    }
  }, [])

  const playWithSoundFallback = useCallback((el: HTMLVideoElement) => {
    try {
      el.muted = false
      el.volume = 1
    } catch {}
    void el.play().catch(() => {
      try {
        el.muted = true
      } catch {}
      void el.play().catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!isVideoTab) return
    if (!resolvedIsVideoFile) return
    if (!activeVideoClip) return
    if (disableClipConstraint) return
    const el = videoRef.current
    if (!el) return
    const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
    const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(activeVideoClip.trimEnd ?? 0)))
    const cur = Number(el.currentTime) || 0
    const desired = Math.max(startAt, Math.min(endAt, cur))
    if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.05) el.currentTime = desired
  }, [activeVideoClip, disableClipConstraint, isVideoTab, resolvedIsVideoFile])

  const placeholderSrc = useMemo(() => createLocalPreviewSvg("暂无预览"), [])

  return (
    <>
      {buffering ? (
        <div className={styles.bufferingOverlay} aria-label="缓冲中">
          <div className={styles.bufferingPill}>
            <div className={styles.bufferingSpinner} aria-hidden />
            缓冲中…
          </div>
        </div>
      ) : null}

      {isVideoTab && resolvedVideoSrc ? (
        resolvedIsVideoFile ? (
          <video
            ref={videoRef}
            src={resolvedVideoSrc}
            preload="auto"
            playsInline
            className={styles.previewVideo}
            onClick={(e) => {
              const el = e.currentTarget
              if (el.paused) {
                playWithSoundFallback(el)
              } else {
                el.pause()
                setBuffering(false)
                clearBufferingRetry()
              }
            }}
            onLoadedMetadata={(e) => {
              setBuffering(false)
              clearBufferingRetry()
              const el = e.currentTarget
              const w = el.videoWidth
              const h = el.videoHeight
              if (w > 0 && h > 0) onMediaAspect(`${w} / ${h}`)
              if (!activeVideoClip || disableClipConstraint) return
              const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
              const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(activeVideoClip.trimEnd ?? 0)))
              const cur = Number(el.currentTime) || 0
              const desired = Math.max(startAt, Math.min(endAt, cur))
              if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.05) el.currentTime = desired
            }}
            onWaiting={() => {
              if (!videoRef.current) return
              setBuffering(true)
              clearBufferingRetry()
              bufferingRetryRef.current = window.setTimeout(() => {
                const el = videoRef.current
                if (el && !el.paused) playWithSoundFallback(el)
              }, 1500)
            }}
            onStalled={() => setBuffering(true)}
            onCanPlay={() => {
              setBuffering(false)
              clearBufferingRetry()
            }}
            onPlaying={() => {
              setBuffering(false)
              clearBufferingRetry()
            }}
            onError={() => {
              setBuffering(false)
              clearBufferingRetry()
            }}
            onPlay={(e) => {
              if (!activeVideoClip || disableClipConstraint) return
              const el = e.currentTarget
              const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
              if ((Number(el.currentTime) || 0) < startAt - 0.05) el.currentTime = startAt
            }}
            onTimeUpdate={(e) => {
              if (!activeVideoClip || disableClipConstraint) return
              const el = e.currentTarget
              const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
              const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(activeVideoClip.trimEnd ?? 0)))
              const t = Number(el.currentTime) || 0
              if (t < startAt - 0.05) {
                el.currentTime = startAt
                return
              }
              if (t >= endAt - 0.05) {
                el.pause()
                el.currentTime = endAt
              }
            }}
          />
        ) : (
          <Image
            src={activeImageSrc || placeholderSrc}
            alt={activeTitle}
            fill
            unoptimized
            sizes="(max-width: 1023px) 100vw, 980px"
            style={{ objectFit: "contain" }}
            onLoadingComplete={(img) => {
              const w = img.naturalWidth
              const h = img.naturalHeight
              if (w > 0 && h > 0) onMediaAspect(`${w} / ${h}`)
            }}
          />
        )
      ) : !isVideoTab ? (
        <TwoFrameImagePreview
          key={`${(activeFrameImages?.first ?? "").trim()}|${(activeFrameImages?.last ?? "").trim()}|${activeTitle}`}
          title={activeTitle || "预览"}
          frames={[
            { label: "首帧", src: (activeFrameImages?.first ?? "").trim() || createLocalPreviewSvg(`${activeTitle || "首帧"} / 未生成`) },
            { label: "尾帧", src: (activeFrameImages?.last ?? "").trim() || createLocalPreviewSvg(`${activeTitle || "尾帧"} / 未生成`) }
          ]}
          onImageLoad={({ naturalWidth, naturalHeight }) => {
            if (naturalWidth > 0 && naturalHeight > 0) onMediaAspect(`${naturalWidth} / ${naturalHeight}`)
          }}
          onEdit={onOpenFrameImage}
        />
      ) : (
        <div className={styles.previewFallback}>
          <Image src={placeholderSrc} alt={activeTitle || "预览"} fill unoptimized style={{ objectFit: "contain" }} />
        </div>
      )}
    </>
  )
}
