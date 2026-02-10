import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./PreviewAllPlayer.module.css"
import { createLocalPreviewSvg } from "@/shared/utils/previewUtils"
import type { PreviewPlaylistItem, TimelineAudioClip } from "@/shared/utils/mediaPreviewUtils"

export function PreviewAllPlayer({
  activeTitle,
  currentItem,
  currentItemDurationSeconds,
  previewAllPlaying,
  previewAllLocalTime,
  previewAllElapsedSeconds,
  previewAllSeeking,
  nextPreloadVideoSrc,
  timelineAudioClips,
  onAdvancePreviewAll,
  onUpdatePreviewAllLocalTime,
  onMediaAspect,
  onStopPreviewAll
}: {
  activeTitle: string
  currentItem: PreviewPlaylistItem | null
  currentItemDurationSeconds: number
  previewAllPlaying: boolean
  previewAllLocalTime: number
  previewAllElapsedSeconds: number
  previewAllSeeking?: boolean
  nextPreloadVideoSrc?: string
  timelineAudioClips: TimelineAudioClip[]
  onAdvancePreviewAll: () => void
  onUpdatePreviewAllLocalTime: (time: number) => void
  onMediaAspect: (ar: string) => void
  onStopPreviewAll: () => void
}): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const placeholderTimerRef = useRef<number | null>(null)
  const placeholderIntervalRef = useRef<number | null>(null)
  const advanceGuardRef = useRef<{ until: number }>({ until: 0 })
  const lastItemKeyRef = useRef<string | null>(null)
  const bufferingRetryRef = useRef<number | null>(null)
  const playRetryRef = useRef<number | null>(null)
  const playTokenRef = useRef(0)
  const [buffering, setBuffering] = useState(false)
  const [manualPlayForKey, setManualPlayForKey] = useState<string | null>(null)

  const currentItemHasVideo = Boolean(currentItem?.videoSrc)

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

  const clearBufferingRetry = () => {
    if (bufferingRetryRef.current) {
      window.clearTimeout(bufferingRetryRef.current)
      bufferingRetryRef.current = null
    }
  }

  const clearPlayRetry = () => {
    if (playRetryRef.current) {
      window.clearTimeout(playRetryRef.current)
      playRetryRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearBufferingRetry()
      clearPlayRetry()
      clearPlaceholderTimers()
    }
  }, [])

  const playWithSoundFallback = useCallback((el: HTMLMediaElement) => {
    try {
      ;(el as any).muted = false
      if (typeof (el as any).volume === "number" && (el as any).volume <= 0) (el as any).volume = 1
    } catch {}
    void (el as any).play?.().catch(() => {})
  }, [])

  const tryAutoPlay = useCallback(async (el: HTMLVideoElement): Promise<boolean> => {
    if (!previewAllPlaying) return false
    if (!currentItem?.videoSrc) return false
    try {
      ;(el as any).muted = false
      if (typeof (el as any).volume === "number" && (el as any).volume <= 0) (el as any).volume = 1
    } catch {}
    try {
      const p = (el as any).play?.()
      if (p && typeof p.then === "function") await p
      return !el.paused
    } catch {
      return false
    }
  }, [currentItem?.videoSrc, previewAllPlaying])

  const safeAdvance = useCallback(() => {
    const now = performance.now()
    if (now < advanceGuardRef.current.until) return
    advanceGuardRef.current.until = now + 300
    const el = videoRef.current
    if (el) el.pause()
    onAdvancePreviewAll()
  }, [onAdvancePreviewAll])

  useEffect(() => {
    if (!currentItem) {
      clearPlaceholderTimers()
      return
    }

    clearPlaceholderTimers()
    clearPlayRetry()
    playTokenRef.current += 1
    const token = playTokenRef.current
    const itemKey = String(currentItem?.key ?? "")

    if (!previewAllPlaying) {
      const el = videoRef.current
      if (el) el.pause()
      return
    }

    if (currentItem.videoSrc) {
      const el = videoRef.current
      if (!el) {
        return
      }
      void (async () => {
        const ok = await tryAutoPlay(el)
        if (token !== playTokenRef.current) return
        if (!ok) {
          const schedule = (delays: number[], idx: number) => {
            if (token !== playTokenRef.current) return
            const v = videoRef.current
            if (!v) return
            if (!previewAllPlaying) return
            if (!v.paused) return
            if (idx >= delays.length) {
              setManualPlayForKey(itemKey || null)
              return
            }
            playRetryRef.current = window.setTimeout(async () => {
              if (token !== playTokenRef.current) return
              const vv = videoRef.current
              if (!vv) return
              if (!previewAllPlaying) return
              if (!vv.paused) return
              const ok2 = await tryAutoPlay(vv)
              if (token !== playTokenRef.current) return
              if (!ok2) schedule(delays, idx + 1)
            }, delays[idx]!)
          }
          schedule([0, 200, 400, 700, 1100], 0)
        }
      })()
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
  }, [currentItem, currentItemDurationSeconds, playWithSoundFallback, previewAllLocalTime, previewAllPlaying, onUpdatePreviewAllLocalTime, safeAdvance, tryAutoPlay])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.load()
    if (previewAllPlaying && currentItem?.videoSrc) void tryAutoPlay(el)
  }, [currentItem?.videoSrc, previewAllPlaying, tryAutoPlay])

  useEffect(() => {
    if (!currentItem?.videoSrc) return
    const key = currentItem?.key ?? ""
    if (lastItemKeyRef.current === key) return
    lastItemKeyRef.current = key
    const el = videoRef.current
    if (!el) return
    const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
    const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
    const desired = Math.max(startAt, Math.min(endAt, startAt + Math.max(0, previewAllLocalTime)))
    if (Number.isFinite(desired)) {
      try {
        el.currentTime = desired
      } catch {}
    }
    if (previewAllPlaying) void tryAutoPlay(el)
  }, [
    currentItem?.key,
    currentItem?.trimEndSeconds,
    currentItem?.trimStartSeconds,
    currentItem?.videoSrc,
    previewAllLocalTime,
    previewAllPlaying,
    tryAutoPlay
  ])

  useEffect(() => {
    const now = Math.max(0, Number(previewAllElapsedSeconds) || 0)
    for (const el of audioRefs.current.values()) {
      try {
        el.pause()
      } catch {}
    }
    for (const clip of timelineAudioClips) {
      const el = audioRefs.current.get(clip.id)
      if (!el) continue
      const src = (clip.src ?? "").trim()
      if (!src) continue

      const start = Number(clip.start) || 0
      const end = start + (Number(clip.duration) || 0)
      const isActive = now >= start && now < end - 1e-3
      if (!isActive) continue

      const desired = Math.max(0, now - start)
      const cur = Number(el.currentTime) || 0
      if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.25) {
        try {
          el.currentTime = desired
        } catch {}
      }

      if (previewAllPlaying) playWithSoundFallback(el)
    }
  }, [playWithSoundFallback, previewAllElapsedSeconds, previewAllPlaying, timelineAudioClips])

  useEffect(() => {
    if (!currentItem?.videoSrc) return
    const el = videoRef.current
    if (!el) return
    const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
    const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
    const desired = Math.max(startAt, Math.min(endAt, startAt + Math.max(0, previewAllLocalTime)))
    const cur = Number(el.currentTime) || 0
    if (Number.isFinite(desired) && Math.abs(cur - desired) > 0.05) {
      el.currentTime = desired
      if (previewAllPlaying) void tryAutoPlay(el)
    }
  }, [currentItem?.trimEndSeconds, currentItem?.trimStartSeconds, currentItem?.videoSrc, previewAllLocalTime, previewAllPlaying, tryAutoPlay])

  const placeholderSrc = useMemo(() => createLocalPreviewSvg("生成中"), [])

  if (!currentItem) {
    return (
      <div className={styles.previewFallback}>
        <Image src={placeholderSrc} alt={activeTitle} fill unoptimized style={{ objectFit: "contain" }} />
      </div>
    )
  }

  return (
    <>
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
        {timelineAudioClips.map((c) => (
          <audio
            key={c.id}
            ref={(el) => {
              if (el) audioRefs.current.set(c.id, el)
              else audioRefs.current.delete(c.id)
            }}
            src={c.src ?? ""}
            preload="metadata"
          />
        ))}
        {nextPreloadVideoSrc ? <video src={nextPreloadVideoSrc} preload="auto" playsInline /> : null}
      </div>

      {buffering ? (
        <div className={styles.bufferingOverlay} aria-label="缓冲中">
          <div className={styles.bufferingPill}>
            <div className={styles.bufferingSpinner} aria-hidden />
            缓冲中…
          </div>
        </div>
      ) : null}

      {currentItemHasVideo ? (
        <video
          ref={videoRef}
          src={currentItem?.videoSrc ?? ""}
          preload="auto"
          playsInline
          autoPlay
          className={styles.previewVideo}
          onClick={(e) => {
            const el = e.currentTarget
            if (el.paused) {
              setManualPlayForKey(null)
              void tryAutoPlay(el)
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
            const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
            const endAt = Math.max(startAt, (Number(el.duration) || 0) - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
            const desired = Math.max(startAt, Math.min(endAt, startAt + Math.max(0, previewAllLocalTime)))
            if (Number.isFinite(desired)) el.currentTime = desired
            if (previewAllPlaying) void tryAutoPlay(el)
          }}
          onWaiting={() => {
            if (!previewAllPlaying) return
            setBuffering(true)
            clearBufferingRetry()
            bufferingRetryRef.current = window.setTimeout(() => {
              const el = videoRef.current
              if (el && previewAllPlaying) void tryAutoPlay(el)
            }, 1500)
          }}
          onStalled={() => {
            if (!previewAllPlaying) return
            setBuffering(true)
          }}
          onCanPlay={() => {
            setBuffering(false)
            clearBufferingRetry()
            const el = videoRef.current
            if (el && previewAllPlaying && el.paused) void tryAutoPlay(el)
          }}
          onPlaying={() => {
            setBuffering(false)
            clearBufferingRetry()
            setManualPlayForKey(null)
          }}
          onError={() => {
            setBuffering(false)
            clearBufferingRetry()
            setManualPlayForKey(String(currentItem?.key ?? "") || null)
          }}
          onTimeUpdate={(e) => {
            if (previewAllSeeking) return
            const el = e.currentTarget
            const duration = Number(el.duration) || 0
            if (!Number.isFinite(duration) || duration <= 0) return
            const t = Number(el.currentTime) || 0
            const startAt = Math.max(0, Number(currentItem?.trimStartSeconds ?? 0))
            const endAt = Math.max(startAt, duration - Math.max(0, Number(currentItem?.trimEndSeconds ?? 0)))
            if (endAt <= startAt + 0.05) return
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
        <div className={styles.previewFallback}>
          <Image src={placeholderSrc} alt={currentItem.title ?? activeTitle} fill unoptimized style={{ objectFit: "contain" }} />
        </div>
      )}

      {manualPlayForKey && manualPlayForKey === String(currentItem?.key ?? "") && previewAllPlaying && currentItemHasVideo ? (
        <button
          type="button"
          className={styles.manualPlayButton}
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            setManualPlayForKey(null)
            void tryAutoPlay(el)
          }}
        >
          点击播放
        </button>
      ) : null}

      <button
        type="button"
        className={styles.previewStopButton}
        onClick={() => {
          setBuffering(false)
          clearBufferingRetry()
          onStopPreviewAll()
        }}
        aria-label="停止全片预览"
      />
    </>
  )
}
