import { useMemo, useState, type ReactElement } from "react"
import styles from "./VideoPlayer.module.css"
import { PreviewAllPlayer } from "@/shared/ui/mediaPreview/PreviewAllPlayer"
import { SinglePlayer } from "./SinglePlayer"
import type { PreviewPlaylistItem, TimelineAudioClip, TimelineVideoClip } from "@/shared/utils/mediaPreviewUtils"

type Props = {
  mode: "image" | "video"
  activeImageSrc: string
  activeFrameImages?: { first?: string | null; last?: string | null }
  activeTitle: string
  onOpenFrameImage?: (frame: { label: string; src: string }) => void
  previewAllActive: boolean
  previewAllPlaying: boolean
  previewAllLocalTime: number
  previewAllElapsedSeconds: number
  previewAllSeeking?: boolean
  nextPreloadVideoSrc?: string
  currentItem: PreviewPlaylistItem | null
  currentItemDurationSeconds: number
  timelineVideoClips: TimelineVideoClip[]
  timelineAudioClips: TimelineAudioClip[]
  activeVideoClip?: TimelineVideoClip | null
  disableClipConstraint?: boolean
  onRequestVideoEdit?: () => void
  onDownloadVideoEdit?: () => void
  videoEditLoading?: boolean
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
  previewAllElapsedSeconds,
  previewAllSeeking,
  nextPreloadVideoSrc,
  currentItem,
  currentItemDurationSeconds,
  timelineVideoClips,
  timelineAudioClips,
  activeVideoClip,
  disableClipConstraint,
  onRequestVideoEdit,
  onDownloadVideoEdit,
  videoEditLoading,
  onStopPreviewAll,
  onTogglePreviewAllPlaying,
  onAdvancePreviewAll,
  onUpdatePreviewAllLocalTime,
  onStartPreviewAll
}: Props): ReactElement {
  const [mediaAspect, setMediaAspect] = useState<string>("16 / 9")

  const isVideoTab = mode === "video"
  const previewStyle = useMemo(() => ({ ["--media-ar" as any]: mediaAspect }), [mediaAspect])
  const resolvedVideoSrc = useMemo(() => {
    if (!isVideoTab) return ""
    if (previewAllActive) return (currentItem?.videoSrc ?? "").trim()
    const fromClip = ((activeVideoClip as any)?.src as string | undefined) ?? ""
    const clip = typeof fromClip === "string" ? fromClip.trim() : ""
    if (clip) return clip
    return (activeImageSrc ?? "").trim()
  }, [activeImageSrc, activeVideoClip, currentItem?.videoSrc, isVideoTab, previewAllActive])

  const resolvedIsVideoFile = useMemo(() => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(resolvedVideoSrc), [resolvedVideoSrc])
  const isShowingVideoEl = isVideoTab && (previewAllActive ? Boolean(currentItem?.videoSrc) : resolvedIsVideoFile)
  const shouldFillInner = isVideoTab

  const handleStartClick = () => {
    if (previewAllActive) {
      onStopPreviewAll()
      return
    }

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
          <div className={styles.previewTitleRow}>
            <div className={styles.previewTitle} title={previewAllActive ? (currentItem?.title ?? activeTitle) : activeTitle}>
              {(previewAllActive ? (currentItem?.title ?? activeTitle) : activeTitle) || "预览"}
            </div>
            <div className={styles.previewHint}>{isVideoTab ? "视频预览" : "图片预览"}</div>
          </div>
          <div className={styles.previewActions}>
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
            {isVideoTab && onRequestVideoEdit ? (
              <button
                type="button"
                className={styles.previewAllBtnGhost}
                style={{ pointerEvents: "auto", height: 28, borderRadius: 999, opacity: videoEditLoading ? 0.7 : 1 }}
                onClick={() => {
                  if (onDownloadVideoEdit) return onDownloadVideoEdit()
                  void onRequestVideoEdit()
                }}
                disabled={Boolean(videoEditLoading)}
              >
                {onDownloadVideoEdit ? "下载成片" : videoEditLoading ? "生成中…" : "生成成片"}
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
          <PreviewAllPlayer
            activeTitle={activeTitle}
            currentItem={currentItem}
            currentItemDurationSeconds={currentItemDurationSeconds}
            previewAllPlaying={previewAllPlaying}
            previewAllLocalTime={previewAllLocalTime}
            previewAllElapsedSeconds={previewAllElapsedSeconds}
            previewAllSeeking={previewAllSeeking}
            nextPreloadVideoSrc={nextPreloadVideoSrc}
            timelineAudioClips={timelineAudioClips}
            onAdvancePreviewAll={onAdvancePreviewAll}
            onUpdatePreviewAllLocalTime={onUpdatePreviewAllLocalTime}
            onMediaAspect={setMediaAspect}
            onStopPreviewAll={onStopPreviewAll}
          />
        ) : (
          <SinglePlayer
            isVideoTab={isVideoTab}
            activeImageSrc={activeImageSrc}
            activeFrameImages={activeFrameImages}
            activeTitle={activeTitle}
            onOpenFrameImage={onOpenFrameImage}
            resolvedVideoSrc={resolvedVideoSrc}
            resolvedIsVideoFile={resolvedIsVideoFile}
            activeVideoClip={activeVideoClip}
            disableClipConstraint={disableClipConstraint}
            onMediaAspect={setMediaAspect}
          />
        )}
      </div>
    </div>
  )
}
