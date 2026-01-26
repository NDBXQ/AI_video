import { type ReactElement, type RefObject } from "react"
import styles from "../CreatePage/VideoTimelineEditor.module.css"
import { TimelineTrack } from "./TimelineTrack"
import {
  type VideoClip,
  type AudioClip,
  PX_PER_SECOND,
  TRACK_OFFSET_PX,
  clipLeftPx,
  clipWidthPx,
  clamp
} from "../../utils/timelineUtils"

interface TimelineRendererProps {
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  activeId: string
  selectedClip: { type: "video" | "audio"; id: string } | null
  totalSeconds: number
  widthPx: number
  dragOver: boolean
  playheadActive?: boolean
  playheadPx: number | null
  playheadSeconds?: number | null
  onSeekPlayheadSeconds?: (seconds: number) => void
  timelineRef: RefObject<HTMLDivElement>
  wrapRef: RefObject<HTMLDivElement>
  keyboardScopeRef: RefObject<HTMLDivElement>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  beginSeek: (e: React.PointerEvent) => void
  makeDragHandler: (clip: VideoClip) => (e: React.PointerEvent) => void
  makeAudioDragHandler: (clip: AudioClip) => (e: React.PointerEvent) => void
  makeTrimHandler: (clip: VideoClip, edge: "start" | "end") => (e: React.PointerEvent) => void
  onClipClick: (type: "video" | "audio", id: string, segmentId?: string) => void
}

export function TimelineRenderer({
  videoClips,
  audioClips,
  activeId,
  selectedClip,
  totalSeconds,
  widthPx,
  dragOver,
  playheadActive,
  playheadPx,
  playheadSeconds,
  onSeekPlayheadSeconds,
  timelineRef,
  wrapRef,
  keyboardScopeRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onKeyDown,
  beginSeek,
  makeDragHandler,
  makeAudioDragHandler,
  makeTrimHandler,
  onClipClick
}: TimelineRendererProps): ReactElement {

  const renderTimeRuler = () => {
    const ticks = []
    for (let s = 0; s <= totalSeconds; s += 1) {
      ticks.push(
        <div key={s} className={styles.tick} style={{ left: TRACK_OFFSET_PX + s * PX_PER_SECOND }}>
          <div className={styles.tickLine} />
          {s % 2 === 0 ? <div className={styles.tickLabel}>{s}s</div> : null}
        </div>
      )
    }
    return <div className={styles.ruler}>{ticks}</div>
  }

  return (
    <div className={styles.editor}>
      <div
        className={`${styles.timelineWrap} ${dragOver ? styles.timelineWrapDragOver : ""}`}
        ref={keyboardScopeRef}
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onPointerDown={() => keyboardScopeRef.current?.focus()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.timelineScroll} ref={wrapRef}>
          <div className={styles.timeline} ref={timelineRef} style={{ width: widthPx }}>
            {renderTimeRuler()}
            {playheadActive && onSeekPlayheadSeconds ? <div className={styles.seekLayer} onPointerDown={beginSeek} aria-hidden /> : null}
            {playheadPx !== null ? (
              <>
                <div className={styles.playhead} style={{ left: Math.round(playheadPx) }} aria-hidden />
                {playheadActive && onSeekPlayheadSeconds ? (
                  <div
                    className={styles.playheadHit}
                    style={{ left: Math.round(playheadPx) }}
                    role="button"
                    tabIndex={0}
                    aria-label="拖拽调整播放位置"
                    onPointerDown={beginSeek}
                    onKeyDown={(e) => {
                      if (!onSeekPlayheadSeconds) return
                      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
                      e.preventDefault()
                      const delta = e.key === "ArrowLeft" ? -0.2 : 0.2
                      const next = clamp(Number(playheadSeconds ?? 0) + delta, 0, totalSeconds)
                      onSeekPlayheadSeconds(next)
                    }}
                  />
                ) : null}
              </>
            ) : null}
            
            <TimelineTrack label="视频">
              {videoClips.map((clip) => {
                const active = clip.segmentId === activeId
                const selected = selectedClip?.type === "video" && selectedClip.id === clip.id
                const left = clipLeftPx(clip.start + clip.trimStart)
                const width = clipWidthPx(clip.duration - clip.trimStart - clip.trimEnd)
                return (
                  <div
                    key={clip.id}
                    className={`${styles.clip} ${active ? styles.clipActive : ""} ${selected ? styles.clipSelected : ""}`}
                    style={{ left, width }}
                    onPointerDown={makeDragHandler(clip)}
                    onClick={() => onClipClick("video", clip.id, clip.segmentId)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.clipTitle}>{clip.title}</div>
                    <div data-handle="start" className={styles.clipHandleLeft} onPointerDown={makeTrimHandler(clip, "start")} />
                    <div data-handle="end" className={styles.clipHandleRight} onPointerDown={makeTrimHandler(clip, "end")} />
                  </div>
                )
              })}
            </TimelineTrack>

            <TimelineTrack label="音轨">
              {audioClips.map((clip) => {
                const left = clipLeftPx(clip.start)
                const width = clipWidthPx(clip.duration)
                const selected = selectedClip?.type === "audio" && selectedClip.id === clip.id
                return (
                  <div
                    key={clip.id}
                    className={`${styles.audioClip} ${selected ? styles.clipSelected : ""}`}
                    style={{ left, width }}
                    onPointerDown={makeAudioDragHandler(clip)}
                    onClick={() => onClipClick("audio", clip.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.clipTitle}>{clip.name}</div>
                  </div>
                )
              })}
            </TimelineTrack>
          </div>
        </div>
        <div className={styles.dropHint}>拖拽右侧素材到轨道以添加</div>
      </div>
    </div>
  )
}
