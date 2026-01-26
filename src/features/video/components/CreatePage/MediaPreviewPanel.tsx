
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import styles from "./MediaPreviewPanel.module.css"
import { VideoAssetSidebar } from "../VideoTimeline/VideoAssetSidebar"
import { VideoPlayer } from "../MediaPreview/VideoPlayer"
import { TimelineBar } from "../MediaPreview/TimelineBar"
import { 
  calculatePreviewPlaylist, 
  calculateTimelineVideoClips, 
  normalizeDurationSeconds, 
  Thumbnail, 
  TimelineSegment 
} from "../../utils/mediaPreviewUtils"
import type { VideoAssetGroup } from "../VideoTimeline/VideoAssetSidebar"

type Props = {
  mode: "image" | "video"
  activeImageSrc: string
  activeFrameImages?: { first?: string | null; last?: string | null }
  activeTitle: string
  thumbnails: Thumbnail[]
  activeId: string
  onThumbnailClick: (id: string) => void
  onOpenFrameImage?: (frame: { label: string; src: string }) => void
  timelineSegments?: TimelineSegment[]
  videoAssetGroups?: VideoAssetGroup[]
  timelineKey?: string
  initialTimeline?: { videoClips: any[]; audioClips: any[] } | null
  onTimelineChange?: (timeline: { videoClips: any[]; audioClips: any[] }) => void
}

export function MediaPreviewPanel({
  mode,
  activeImageSrc,
  activeFrameImages,
  activeTitle,
  thumbnails,
  activeId,
  onThumbnailClick,
  onOpenFrameImage,
  timelineSegments,
  videoAssetGroups,
  timelineKey,
  initialTimeline,
  onTimelineChange
}: Props): ReactElement {
  const isVideoTab = mode === "video"

  const segments = useMemo(() => timelineSegments ?? [], [timelineSegments])

  const sidebarKey = `ai-video:asset-sidebar-w:${timelineKey ?? "default"}`
  const [assetSidebarWidth, setAssetSidebarWidth] = useState(280)
  const [splitterActive, setSplitterActive] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(sidebarKey)
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) queueMicrotask(() => setAssetSidebarWidth(n))
    } catch {}
  }, [sidebarKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(sidebarKey, String(assetSidebarWidth))
    } catch {}
  }, [assetSidebarWidth, sidebarKey])
  
  useEffect(() => {
    if (!splitterActive) return
    if (typeof window === "undefined") return

    const onMove = (e: PointerEvent) => {
      const snap = dragRef.current
      if (!snap) return
      const delta = snap.startX - e.clientX
      const next = Math.max(176, Math.min(480, snap.startW + delta))
      setAssetSidebarWidth(next)
    }

    const onUp = () => {
      dragRef.current = null
      setSplitterActive(false)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)

    const prevCursor = document.body.style.cursor
    document.body.style.cursor = "col-resize"

    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      document.body.style.cursor = prevCursor
    }
  }, [splitterActive])

  const [previewAllActive, setPreviewAllActive] = useState(false)
  const [previewAllIndex, setPreviewAllIndex] = useState(0)
  const [previewAllPlaying, setPreviewAllPlaying] = useState(false)
  const [previewAllLocalTime, setPreviewAllLocalTime] = useState(0)

  const timelineVideoClips = useMemo(() => calculateTimelineVideoClips(initialTimeline), [initialTimeline])
  const activeTimelineVideoClip = useMemo(() => {
    if (!isVideoTab) return null
    const targetId = (activeId ?? "").trim()
    if (!targetId) return null
    const candidates = timelineVideoClips.filter((c) => c.segmentId === targetId)
    if (candidates.length === 0) return null
    const sorted = [...candidates].sort((a, b) => (a.start + a.trimStart) - (b.start + b.trimStart))
    return sorted[0] ?? null
  }, [activeId, isVideoTab, timelineVideoClips])

  const previewPlaylist = useMemo(() => 
    calculatePreviewPlaylist(isVideoTab, previewAllActive, segments, timelineVideoClips),
    [isVideoTab, previewAllActive, segments, timelineVideoClips]
  )

  const currentItem = previewAllActive ? previewPlaylist[previewAllIndex] : null
  const currentItemDurationSeconds = currentItem ? currentItem.playDurationSeconds : 0

  const prefixPlaylistSeconds = useMemo(() => {
    if (!previewAllActive) return 0
    let sum = 0
    for (let i = 0; i < previewAllIndex; i += 1) sum += previewPlaylist[i]?.playDurationSeconds ?? 0
    return sum
  }, [previewAllActive, previewAllIndex, previewPlaylist])

  const totalPlaylistSeconds = useMemo(() => previewPlaylist.reduce((sum, it) => sum + (it.playDurationSeconds ?? 0), 0), [previewPlaylist])
  const previewAllElapsedSeconds = previewAllActive ? prefixPlaylistSeconds + previewAllLocalTime : 0
  const previewAllPercent = previewAllActive && totalPlaylistSeconds > 0 ? Math.round((previewAllElapsedSeconds / totalPlaylistSeconds) * 100) : 0

  const stopPreviewAll = useCallback(() => {
    setPreviewAllPlaying(false)
    setPreviewAllActive(false)
    setPreviewAllIndex(0)
    setPreviewAllLocalTime(0)
  }, [])

  const seekPreviewAllSeconds = useCallback(
    (seconds: number) => {
      if (!previewAllActive) return
      const target = Math.max(0, Math.min(totalPlaylistSeconds, seconds))
      let sum = 0
      for (let i = 0; i < previewPlaylist.length; i += 1) {
        const dur = previewPlaylist[i]?.playDurationSeconds ?? 0
        if (i === previewPlaylist.length - 1 || target < sum + dur) {
          setPreviewAllIndex(i)
          setPreviewAllLocalTime(Math.max(0, target - sum))
          return
        }
        sum += dur
      }
    },
    [previewAllActive, previewPlaylist, totalPlaylistSeconds]
  )

  const advancePreviewAll = useCallback(() => {
    setPreviewAllLocalTime(0)
    setPreviewAllIndex((prev) => {
      const next = prev + 1
      if (next >= previewPlaylist.length) {
        setPreviewAllPlaying(false)
        setPreviewAllActive(false)
        return 0
      }
      return next
    })
  }, [previewPlaylist.length])

  const handleStartPreviewAll = useCallback(() => {
    setPreviewAllActive(true)
    setPreviewAllIndex(0)
    setPreviewAllLocalTime(0)
    setPreviewAllPlaying(true)
  }, [])

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isVideoTab) return
      setSplitterActive(true)
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: assetSidebarWidth }
    },
    [assetSidebarWidth, isVideoTab]
  )

  return (
    <main
      className={`${styles.main} ${isVideoTab ? styles.mainVideo : styles.mainImage}`}
      aria-label="预览区"
      style={{ ["--asset-sidebar-w" as any]: `${assetSidebarWidth}px` } as any}
    >
      <div className={`${styles.topRow} ${isVideoTab ? styles.topRowVideo : ""}`} aria-label="预览与素材区">
        <div className={styles.previewCard}>
          <VideoPlayer
            mode={mode}
            activeImageSrc={activeImageSrc}
            activeFrameImages={activeFrameImages}
            activeTitle={activeTitle}
            onOpenFrameImage={onOpenFrameImage}
            previewAllActive={previewAllActive}
            previewAllPlaying={previewAllPlaying}
            previewAllLocalTime={previewAllLocalTime}
            currentItem={currentItem}
            currentItemDurationSeconds={currentItemDurationSeconds}
            timelineVideoClips={timelineVideoClips}
            activeVideoClip={activeTimelineVideoClip}
            onStopPreviewAll={stopPreviewAll}
            onTogglePreviewAllPlaying={() => setPreviewAllPlaying((v) => !v)}
            onAdvancePreviewAll={advancePreviewAll}
            onUpdatePreviewAllLocalTime={setPreviewAllLocalTime}
            onStartPreviewAll={handleStartPreviewAll}
          />
        </div>

        {isVideoTab ? (
          <>
            <div
              className={`${styles.splitter} ${splitterActive ? styles.splitterActive : ""}`}
              role="separator"
              aria-label="调整预览与素材区域宽度"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setAssetSidebarWidth((w) => Math.max(176, Math.min(480, w + 16)))
                if (e.key === "ArrowRight") setAssetSidebarWidth((w) => Math.max(176, Math.min(480, w - 16)))
              }}
            />
            <div className={styles.assetSidebarWrap}>
              <VideoAssetSidebar videoSegments={segments as any} videoGroups={videoAssetGroups} />
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.dock} aria-label="时间线 Dock">
        <TimelineBar
          mode={mode}
          activeId={activeId}
          thumbnails={thumbnails}
          onThumbnailClick={onThumbnailClick}
          timelineSegments={segments}
          timelineKey={timelineKey}
          initialTimeline={initialTimeline}
          onTimelineChange={onTimelineChange}
          previewAllActive={previewAllActive}
          previewAllIndex={previewAllIndex}
          previewAllPercent={previewAllPercent}
          previewAllPlaying={previewAllPlaying}
          previewAllElapsedSeconds={previewAllElapsedSeconds}
          onSeekPreviewAllSeconds={seekPreviewAllSeconds}
          onStopPreviewAll={stopPreviewAll}
          onTogglePreviewAllPlaying={() => setPreviewAllPlaying((v) => !v)}
          onStartPreviewAll={handleStartPreviewAll}
          onSetPreviewAllIndex={setPreviewAllIndex}
          onSetPreviewAllLocalTime={setPreviewAllLocalTime}
        />
      </div>
    </main>
  )
}
