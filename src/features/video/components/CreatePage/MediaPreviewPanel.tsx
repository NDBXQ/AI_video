
import { useCallback, useMemo, useState, type ReactElement } from "react"
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

type Props = {
  mode: "image" | "video"
  activeImageSrc: string
  activeFrameImages?: { first?: string | null; last?: string | null }
  activeTitle: string
  thumbnails: Thumbnail[]
  activeId: string
  onThumbnailClick: (id: string) => void
  timelineSegments?: TimelineSegment[]
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
  timelineSegments,
  timelineKey,
  initialTimeline,
  onTimelineChange
}: Props): ReactElement {
  const isVideoTab = mode === "video"

  const segments = useMemo(() => timelineSegments ?? [], [timelineSegments])
  
  const [previewAllActive, setPreviewAllActive] = useState(false)
  const [previewAllIndex, setPreviewAllIndex] = useState(0)
  const [previewAllPlaying, setPreviewAllPlaying] = useState(false)
  const [previewAllLocalTime, setPreviewAllLocalTime] = useState(0)

  const timelineVideoClips = useMemo(() => calculateTimelineVideoClips(initialTimeline), [initialTimeline])

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

  return (
    <main className={styles.main} aria-label="预览区">
      <div className={styles.topArea} aria-label="预览与素材区">
        <VideoPlayer
          mode={mode}
          activeImageSrc={activeImageSrc}
          activeFrameImages={activeFrameImages}
          activeTitle={activeTitle}
          previewAllActive={previewAllActive}
          previewAllPlaying={previewAllPlaying}
          currentItem={currentItem}
          currentItemDurationSeconds={currentItemDurationSeconds}
          timelineVideoClips={timelineVideoClips}
          onStopPreviewAll={stopPreviewAll}
          onTogglePreviewAllPlaying={() => setPreviewAllPlaying(v => !v)}
          onAdvancePreviewAll={advancePreviewAll}
          onUpdatePreviewAllLocalTime={setPreviewAllLocalTime}
          onStartPreviewAll={handleStartPreviewAll}
        />

        {isVideoTab ? (
          <div className={styles.assetSidebarWrap}>
            <VideoAssetSidebar videoSegments={segments as any} />
          </div>
        ) : null}
      </div>

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
        onStopPreviewAll={stopPreviewAll}
        onTogglePreviewAllPlaying={() => setPreviewAllPlaying(v => !v)}
        onStartPreviewAll={handleStartPreviewAll}
        onSetPreviewAllIndex={setPreviewAllIndex}
        onSetPreviewAllLocalTime={setPreviewAllLocalTime}
      />
    </main>
  )
}
