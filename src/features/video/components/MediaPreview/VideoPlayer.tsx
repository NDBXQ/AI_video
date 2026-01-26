
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./VideoPlayer.module.css"
import { TwoFrameImagePreview } from "../CreatePage/TwoFrameImagePreview"
import { createLocalPreviewSvg } from "../../utils/previewUtils"
import { PreviewPlaylistItem, TimelineVideoClip } from "../../utils/mediaPreviewUtils"

type Props = {
  mode: "image" | "video"
  activeImageSrc: string
  activeFrameImages?: { first?: string | null; last?: string | null }
  activeTitle: string
  onOpenFrameImage?: (frame: { label: string; src: string }) => void
  previewAllActive: boolean
  previewAllPlaying: boolean
  previewAllLocalTime: number
  currentItem: PreviewPlaylistItem | null
  currentItemDurationSeconds: number
  timelineVideoClips: TimelineVideoClip[]
  activeVideoClip?: TimelineVideoClip | null
  onStopPreviewAll: () => void
  onTogglePreviewAllPlaying: () => void
  onAdvancePreviewAll: () => void
  onUpdatePreviewAllLocalTime: (time: number) => void
  onStartPreviewAll: () => void
}

export function VideoPlayer({
  mode,
  activeImageSrc,
  activeFrameImages,
  activeTitle,
  onOpenFrameImage,
  previewAllActive,
  previewAllPlaying,
  previewAllLocalTime,
  currentItem,
  currentItemDurationSeconds,
  timelineVideoClips,
  activeVideoClip,
  onStopPreviewAll,
  onTogglePreviewAllPlaying,
  onAdvancePreviewAll,
  onUpdatePreviewAllLocalTime,
  onStartPreviewAll
}: Props): ReactElement {
  const [mediaAspect, setMediaAspect] = useState<string>("16 / 9")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const placeholderTimerRef = useRef<number | null>(null)
  const placeholderIntervalRef = useRef<number | null>(null)
  const advanceGuardRef = useRef<{ until: number }>({ until: 0 })

  const isVideoTab = mode === "video"
  const isVideoFile = useMemo(() => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(activeImageSrc), [activeImageSrc])
  const currentItemHasVideo = Boolean(currentItem?.videoSrc)
  const previewStyle = useMemo(() => ({ ["--media-ar" as any]: mediaAspect }), [mediaAspect])
  const isShowingVideoEl = isVideoTab && (previewAllActive ? currentItemHasVideo : isVideoFile)
  const shouldFillInner = isVideoTab

  useEffect(() => {
    if (previewAllActive) return
    if (!isVideoTab) return
    if (!isVideoFile) return
    if (!activeVideoClip) return
    const el = videoRef.current
    if (!el) return
    const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
    const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(activeVideoClip.trimEnd ?? 0)))
    const cur = Number(el.currentTime) || 0
    const desired = Math.max(startAt, Math.min(endAt, cur))
    if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.05) el.currentTime = desired
  }, [activeVideoClip, isVideoFile, isVideoTab, previewAllActive])

  const clearPlaceholderTimers = () => {
    if (placeholderTimerRef.current) {
      window.clearTimeout(placeholderTimerRef.current)
      placeholderTimerRef.current = null
    }
    if (placeholderIntervalRef.current) {
      window.clearInterval(placeholderIntervalRef.current)
      placeholderIntervalRef.current = null
    }
  }

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

  const safeAdvance = useCallback(() => {
    const now = performance.now()
    if (now < advanceGuardRef.current.until) return
    advanceGuardRef.current.until = now + 300
    const el = videoRef.current
    if (el) el.pause()
    onAdvancePreviewAll()
  }, [onAdvancePreviewAll])

  // Handle preview playback logic
  useEffect(() => {
    if (!previewAllActive) {
      clearPlaceholderTimers()
      return
    }
    if (!currentItem) return

    clearPlaceholderTimers()

    if (!previewAllPlaying) {
      const el = videoRef.current
      if (el) el.pause()
      return
    }

    if (currentItem.videoSrc) {
      const el = videoRef.current
      if (!el) return
      playWithSoundFallback(el)
      return
    }

    const initialLocal = Math.max(0, Math.min(currentItemDurationSeconds, previewAllLocalTime))
    const remainingMs = Math.max(0, Math.round((currentItemDurationSeconds - initialLocal) * 1000))
    const startedAt = performance.now()
    placeholderIntervalRef.current = window.setInterval(() => {
      const elapsed = initialLocal + (performance.now() - startedAt) / 1000
      onUpdatePreviewAllLocalTime(Math.min(currentItemDurationSeconds, Math.max(0, elapsed)))
    }, 80)
    placeholderTimerRef.current = window.setTimeout(() => {
      safeAdvance()
    }, remainingMs)
  }, [
    currentItem,
    currentItemDurationSeconds,
    playWithSoundFallback,
    previewAllActive,
    previewAllPlaying,
    previewAllLocalTime,
    onUpdatePreviewAllLocalTime,
    safeAdvance
  ])

  useEffect(() => {
    if (!previewAllActive) return
    if (!currentItem?.videoSrc) return
    const el = videoRef.current
    if (!el) return
    const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
    const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
    const desired = Math.max(startAt, Math.min(endAt, startAt + Math.max(0, previewAllLocalTime)))
    const cur = Number(el.currentTime) || 0
    if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.25) {
      el.currentTime = desired
      if (previewAllPlaying) playWithSoundFallback(el)
    }
  }, [currentItem?.videoSrc, currentItem?.trimEndSeconds, currentItem?.trimStartSeconds, playWithSoundFallback, previewAllActive, previewAllLocalTime, previewAllPlaying])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearPlaceholderTimers()
    }
  }, [])

  const handleStartClick = () => {
    if (previewAllActive) {
      onStopPreviewAll()
      return
    }
    
    // Validation logic
    if (timelineVideoClips.length > 0) {
      const sorted = [...timelineVideoClips].sort((a, b) => (a.start + a.trimStart) - (b.start + b.trimStart))
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const cur = sorted[i]!
        const next = sorted[i + 1]!
        const curStart = cur.start + Math.max(0, cur.trimStart)
        const curEnd = cur.start + cur.duration - Math.max(0, cur.trimEnd)
        const nextStart = next.start + Math.max(0, next.trimStart)
        if (nextStart < curEnd - 1e-3) {
          alert("时间线上存在重叠片段，暂不支持全片预览，请调整为不重叠后再试")
          return
        }
        if (curEnd <= curStart + 1e-3) {
          alert("时间线上存在无效片段（裁剪后时长为 0），请调整后再试")
          return
        }
      }
    }
    
    onStartPreviewAll()
    const tryPlay = (tries: number) => {
      const el = videoRef.current
      if (el) {
        playWithSoundFallback(el)
        return
      }
      if (tries <= 0) return
      window.requestAnimationFrame(() => tryPlay(tries - 1))
    }
    window.requestAnimationFrame(() => tryPlay(10))
  }

  return (
    <div className={styles.preview}>
      <div
        className={`${styles.previewInner} ${shouldFillInner ? styles.previewInnerFill : ""} ${
          isShowingVideoEl ? styles.previewInnerWithControls : ""
        }`}
        style={previewStyle}
      >
        <div className={styles.previewOverlay} aria-label="预览信息">
          <div className={styles.previewTitle} title={previewAllActive ? (currentItem?.title ?? activeTitle) : activeTitle}>
            {(previewAllActive ? (currentItem?.title ?? activeTitle) : activeTitle) || "预览"}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className={styles.previewHint}>{isVideoTab ? "视频预览" : "图片预览"}</div>
            {isVideoTab ? (
              <button
                type="button"
                className={styles.previewAllBtn}
                style={{ pointerEvents: "auto", height: 28, borderRadius: 999 }}
                onClick={handleStartClick}
              >
                {previewAllActive ? "停止预览" : "全片预览"}
              </button>
            ) : null}
            {isVideoTab && previewAllActive ? (
              <button
                type="button"
                className={styles.previewAllBtnGhost}
                style={{ pointerEvents: "auto", height: 28, borderRadius: 999 }}
                onClick={onTogglePreviewAllPlaying}
              >
                {previewAllPlaying ? "暂停" : "播放"}
              </button>
            ) : null}
          </div>
        </div>
        {previewAllActive ? (
          currentItemHasVideo ? (
            <video
              ref={videoRef}
              key={currentItem?.key ?? "preview"}
              src={currentItem?.videoSrc ?? ""}
              controls
              playsInline
              className={styles.previewVideo}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget
                const w = el.videoWidth
                const h = el.videoHeight
                if (w > 0 && h > 0) setMediaAspect(`${w} / ${h}`)
                const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
                const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
                const desired = Math.max(startAt, Math.min(endAt, startAt + Math.max(0, previewAllLocalTime)))
                if (Number.isFinite(desired)) el.currentTime = desired
                if (previewAllPlaying) playWithSoundFallback(el)
              }}
              onTimeUpdate={(e) => {
                const el = e.currentTarget
                const t = Number(el.currentTime) || 0
                const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
                const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
                if (t >= endAt - 0.05) {
                  safeAdvance()
                  return
                }
                const local = Math.max(0, t - startAt)
                onUpdatePreviewAllLocalTime(Math.min(currentItemDurationSeconds, local))
              }}
              onEnded={() => {
                safeAdvance()
              }}
            />
          ) : (
            <div className={styles.previewPlaceholderVideo} aria-label="占位视频" />
          )
        ) : isVideoTab && activeImageSrc ? (
          isVideoFile ? (
            <video
              ref={videoRef}
              src={activeImageSrc}
              controls
              playsInline
              className={styles.previewVideo}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget
                const w = el.videoWidth
                const h = el.videoHeight
                if (w > 0 && h > 0) setMediaAspect(`${w} / ${h}`)
                if (!activeVideoClip) return
                const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
                const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(activeVideoClip.trimEnd ?? 0)))
                const cur = Number(el.currentTime) || 0
                const desired = Math.max(startAt, Math.min(endAt, cur))
                if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.05) el.currentTime = desired
              }}
              onPlay={(e) => {
                if (!activeVideoClip) return
                const el = e.currentTarget
                const startAt = Math.max(0, Number(activeVideoClip.trimStart ?? 0))
                if ((Number(el.currentTime) || 0) < startAt - 0.05) el.currentTime = startAt
              }}
              onTimeUpdate={(e) => {
                if (!activeVideoClip) return
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
              src={activeImageSrc}
              alt={activeTitle}
              fill
              unoptimized
              sizes="(max-width: 1023px) 100vw, 980px"
              onLoadingComplete={(img) => {
                const w = img.naturalWidth
                const h = img.naturalHeight
                if (w > 0 && h > 0) setMediaAspect(`${w} / ${h}`)
              }}
            />
          )
        ) : !isVideoTab ? (
          <TwoFrameImagePreview
            key={`${(activeFrameImages?.first ?? "").trim()}|${(activeFrameImages?.last ?? "").trim()}|${activeTitle}`}
            title={activeTitle || "预览"}
            frames={[
              {
                label: "首帧",
                src:
                  (activeFrameImages?.first ?? "").trim() ||
                  createLocalPreviewSvg(`${activeTitle || "首帧"} / 未生成`)
              },
              {
                label: "尾帧",
                src:
                  (activeFrameImages?.last ?? "").trim() ||
                  createLocalPreviewSvg(`${activeTitle || "尾帧"} / 未生成`)
              }
            ]}
            onImageLoad={({ naturalWidth, naturalHeight }) => {
              if (naturalWidth > 0 && naturalHeight > 0) setMediaAspect(`${naturalWidth} / ${naturalHeight}`)
            }}
            onEdit={onOpenFrameImage}
          />
        ) : (
          <div className={styles.previewPlaceholder}>暂无预览</div>
        )}
      </div>
    </div>
  )
}
