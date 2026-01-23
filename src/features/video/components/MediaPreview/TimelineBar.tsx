
import { useRef, type ReactElement } from "react"
import styles from "./TimelineBar.module.css"
import { VideoTimelineEditor } from "../CreatePage/VideoTimelineEditor"
import { normalizeDurationSeconds, TimelineSegment, Thumbnail } from "../../utils/mediaPreviewUtils"

type Props = {
  mode: "image" | "video"
  activeId: string
  thumbnails: Thumbnail[]
  onThumbnailClick: (id: string) => void
  timelineSegments: TimelineSegment[]
  timelineKey?: string
  initialTimeline?: { videoClips: any[]; audioClips: any[] } | null
  onTimelineChange?: (timeline: { videoClips: any[]; audioClips: any[] }) => void
  previewAllActive: boolean
  previewAllIndex: number
  previewAllPercent: number
  previewAllPlaying: boolean
  previewAllElapsedSeconds: number
  onStopPreviewAll: () => void
  onTogglePreviewAllPlaying: () => void
  onStartPreviewAll: () => void
  onSetPreviewAllIndex: (index: number) => void
  onSetPreviewAllLocalTime: (time: number) => void
}

export function TimelineBar({
  mode,
  activeId,
  thumbnails,
  onThumbnailClick,
  timelineSegments,
  timelineKey,
  initialTimeline,
  onTimelineChange,
  previewAllActive,
  previewAllIndex,
  previewAllPercent,
  previewAllPlaying,
  previewAllElapsedSeconds,
  onStopPreviewAll,
  onTogglePreviewAllPlaying,
  onStartPreviewAll,
  onSetPreviewAllIndex,
  onSetPreviewAllLocalTime
}: Props): ReactElement {
  const thumbsRef = useRef<HTMLDivElement>(null)
  const isVideoTab = mode === "video"
  const hasTimeline = timelineSegments.length > 0

  return (
    <div className={`${styles.filmstrip} ${isVideoTab ? styles.filmstripEditor : ""}`} aria-label="缩略图列表">
      {isVideoTab ? (
        <div className={styles.editorOnly} aria-label="剪辑轨道区">
          <VideoTimelineEditor
            segments={timelineSegments}
            activeId={activeId}
            onSelectSegment={onThumbnailClick}
            timelineKey={timelineKey}
            initialTimeline={initialTimeline as any}
            onTimelineChange={onTimelineChange as any}
            playheadActive={previewAllActive}
            playheadSeconds={previewAllActive ? previewAllElapsedSeconds : null}
          />
        </div>
      ) : (
        <>
          {hasTimeline ? (
            <div className={styles.timelineRow} aria-label="分镜时间轴">
              <div className={styles.timelineWrap}>
                <div className={styles.timelineBar}>
                  {timelineSegments.map((seg, idx) => {
                    const dur = normalizeDurationSeconds(seg)
                    const isActive = previewAllActive ? idx === previewAllIndex : seg.id === activeId
                    const isMissing = !seg.videoSrc
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        className={`${styles.timelineSeg} ${isActive ? styles.timelineSegActive : ""} ${isMissing ? styles.timelineSegMissing : ""}`}
                        style={{ flexGrow: Math.max(1, Math.round(dur * 10)) }}
                        title={seg.title}
                        onClick={() => {
                          if (previewAllActive) {
                            onSetPreviewAllIndex(idx)
                            onSetPreviewAllLocalTime(0)
                            return
                          }
                          onThumbnailClick(seg.id)
                        }}
                        aria-label={seg.title}
                      >
                        <span className={styles.timelineSegText}>{seg.title}</span>
                      </button>
                    )
                  })}
                  {previewAllActive ? (
                    <div className={styles.timelineCursor} style={{ left: `${Math.max(0, Math.min(100, previewAllPercent))}%` }} aria-hidden />
                  ) : null}
                </div>
                {previewAllActive ? (
                  <div className={styles.timelineMeta} aria-label="完整预览进度">
                    {Math.max(0, Math.min(100, previewAllPercent))}%
                  </div>
                ) : null}
              </div>
              <div className={styles.timelineActions}>
                <button
                  type="button"
                  className={styles.previewAllBtn}
                  onClick={() => {
                    if (previewAllActive) {
                      onStopPreviewAll()
                      return
                    }
                    onStartPreviewAll()
                  }}
                >
                  {previewAllActive ? "停止预览" : "预览完整视频"}
                </button>
                {previewAllActive ? (
                  <button
                    type="button"
                    className={styles.previewAllBtnGhost}
                    onClick={onTogglePreviewAllPlaying}
                  >
                    {previewAllPlaying ? "暂停" : "播放"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.navBtn}
            aria-label="上一张"
            onClick={() => thumbsRef.current?.scrollBy({ left: -132, behavior: "smooth" })}
          >
            ‹
          </button>
          <div className={styles.thumbs} ref={thumbsRef}>
            {thumbnails.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`${styles.thumb} ${it.id === activeId ? styles.thumbActive : ""}`}
                onClick={() => onThumbnailClick(it.id)}
              >
                {it.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="下一张"
            onClick={() => thumbsRef.current?.scrollBy({ left: 132, behavior: "smooth" })}
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
