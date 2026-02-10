"use client"

import { CheckCircle2, Download, LoaderCircle, Pause, PenLine, Play, XCircle } from "lucide-react"
import { useMemo, useState, type ReactElement } from "react"
import styles from "./TvcPreviewPanel.module.css"
import type { TvcPreviewTab } from "@/features/tvc/types"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"
import { PreviewAllPlayer } from "@/shared/ui/mediaPreview/PreviewAllPlayer"
import type { PreviewPlaylistItem, TimelineAudioClip, TimelineVideoClip } from "@/shared/utils/mediaPreviewUtils"

export function TvcPreviewPanel({
  activeTab,
  onTabChange,
  tasks,
  onTaskAction,
  shots,
  isShotlistLoading,
  images,
  videos,
  firstFrameUrlByOrdinal,
  videoClipByOrdinal,
  activeShot,
  finalVideoUrl,
  onAssembleVideo,
  assemblingVideo,
  canAssemble,
  previewAll
}: {
  activeTab: TvcPreviewTab
  onTabChange: (tab: TvcPreviewTab) => void
  tasks?: Array<{
    id: string
    title: string
    status: "queued" | "running" | "done" | "failed"
    kind: "reference_image" | "first_frame" | "video_clip"
    targetOrdinal?: number
    message?: string
  }>
  onTaskAction?: (action: { kind: "send" | "draft"; text: string; meta?: { kind?: "reference_image" | "first_frame" | "video_clip"; targetOrdinal?: number } }) => void
  shots: TimelineShot[]
  isShotlistLoading: boolean
  images?: Array<{ url: string; category: string; name: string; description: string }>
  videos?: Array<{ url: string; title: string; duration: string }>
  firstFrameUrlByOrdinal?: Record<number, string>
  videoClipByOrdinal?: Record<number, { url: string; durationSeconds?: number }>
  activeShot?: TimelineShot | null
  finalVideoUrl?: string | null
  onAssembleVideo?: () => void
  assemblingVideo?: boolean
  canAssemble?: boolean
  previewAll: {
    previewAllActive: boolean
    previewAllPlaying: boolean
    previewAllSeeking: boolean
    hasAnyPlayableVideo: boolean
    currentItem: PreviewPlaylistItem | null
    currentItemDurationSeconds: number
    nextPreloadVideoSrc: string
    previewAllElapsedSeconds: number
    previewAllLocalTime: number
    timelineVideoClips: TimelineVideoClip[]
    timelineAudioClips: TimelineAudioClip[]
    playheadSeconds: number
    startPreviewAll: () => void
    stopPreviewAll: () => void
    togglePreviewAllPlaying: () => void
    advancePreviewAll: () => void
    updatePreviewAllLocalTime: (time: number) => void
    seekPlayheadSeconds: (seconds: number) => void
    onSeekStart: () => void
    onSeekEnd: () => void
  }
}): ReactElement {
  const taskList = tasks ?? []
  const imageList = images ?? []
  const videoList = videos ?? []
  const selected = activeShot ?? null
  const selectedVideoUrl = useMemo(() => {
    if (!selected) return ""
    const seq = Number(selected.sequence ?? 0)
    if (!Number.isFinite(seq) || seq <= 0) return ""
    return String(videoClipByOrdinal?.[seq]?.url ?? "").trim()
  }, [selected, videoClipByOrdinal])
  const selectedFirstImageUrl = selected?.frames?.first?.url ? String(selected.frames.first.url) : ""
  const selectedLastImageUrl = selected?.frames?.last?.url ? String(selected.frames.last.url) : ""
  const selectedFirstPrompt = selected?.frames?.first?.prompt ? String(selected.frames.first.prompt) : ""
  const selectedLastPrompt = selected?.frames?.last?.prompt ? String(selected.frames.last.prompt) : ""
  const selectedScriptText = useMemo(() => {
    if (!selected?.scriptContent) return ""
    if (typeof selected.scriptContent !== "object") return String(selected.scriptContent)

    const raw = selected.scriptContent as Record<string, unknown>
    const record: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = String(k ?? "")
        .replace(/[\u00A0\s]+/g, "")
        .replace(/[：:]+$/g, "")
        .trim()
      if (!key) continue
      const val = String(v ?? "").trim()
      if (!val) continue
      record[key] = val
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = record[k] ?? ""
        if (v) return v
      }
      return ""
    }

    const camera = pick("镜头类型", "镜头", "镜头类别", "shot_type", "type")
    const scene = pick("画面描述", "场景描述", "描述", "画面", "storyboard_text", "description", "内容")
    const action = pick("动作描述", "动作", "action", "action_description")
    const dialog = pick("台词/旁白", "台词", "旁白", "台词旁白", "dialogue", "voice_over", "voiceover", "旁白时间", "台词时间")
    const duration = pick("时长", "duration", "duration_sec", "durationSeconds", "秒")

    const lines: string[] = []
    if (camera) lines.push(`镜头类型: ${camera}`)
    if (scene) lines.push(`画面描述: ${scene}`)
    if (action) lines.push(`动作描述: ${action}`)
    if (dialog) lines.push(`台词/旁白: ${dialog}`)
    if (duration) lines.push(`时长: ${duration}`)
    if (lines.length > 0) return lines.join("\n")

    return Object.entries(record).map(([k, v]) => `${k}: ${v}`).join("\n")
  }, [selected?.scriptContent])

  const selectedScriptKv = useMemo(() => {
    const text = selectedScriptText.trim()
    if (!text) return null
    const lines = text
      .split(/\r?\n/g)
      .map((l) => l.trim())
      .filter(Boolean)

    const kvs: Array<{ key: string; value: string }> = []
    for (const line of lines) {
      const match = line.match(/^([^:：]{1,24})[：:]\s*(.+)$/)
      if (!match) continue
      const key = match[1]?.trim() ?? ""
      const value = match[2]?.trim() ?? ""
      if (!key || !value) continue
      kvs.push({ key, value })
    }

    return kvs.length >= 2 ? kvs : null
  }, [selectedScriptText])

  const selectedImage = useMemo(() => {
    if (!selected) return { url: "", prompt: "" }
    const seq = Number(selected.sequence ?? 0)
    const fromAssets = Number.isFinite(seq) && seq > 0 ? String(firstFrameUrlByOrdinal?.[seq] ?? "").trim() : ""
    if (fromAssets) return { url: fromAssets, prompt: selectedFirstPrompt }
    if (selectedFirstImageUrl) return { url: selectedFirstImageUrl, prompt: selectedFirstPrompt }
    if (selectedLastImageUrl) return { url: selectedLastImageUrl, prompt: selectedLastPrompt }
    return { url: "", prompt: "" }
  }, [firstFrameUrlByOrdinal, selected, selectedFirstImageUrl, selectedFirstPrompt, selectedLastImageUrl, selectedLastPrompt])

  const [promptOpen, setPromptOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState("")

  const openPrompt = () => {
    setPromptDraft(selectedImage.prompt || "")
    setPromptOpen(true)
  }

  const hasAnyShotVideo = Array.isArray(shots) && shots.some((s) => {
    const seq = Number((s as any)?.sequence ?? 0)
    if (!Number.isFinite(seq) || seq <= 0) return false
    return Boolean(String(videoClipByOrdinal?.[seq]?.url ?? "").trim())
  })

  const isVideoTab = activeTab === "video"
  const {
    previewAllActive,
    previewAllPlaying,
    previewAllSeeking,
    currentItem,
    currentItemDurationSeconds,
    nextPreloadVideoSrc,
    previewAllElapsedSeconds,
    previewAllLocalTime,
    timelineVideoClips,
    timelineAudioClips
  } = previewAll

  const handlePreviewAllClick = () => {
    if (previewAllActive) {
      previewAll.stopPreviewAll()
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

    previewAll.startPreviewAll()
  }

  const hasAnyPlayableVideo = useMemo(() => {
    return Boolean(isVideoTab && previewAll.hasAnyPlayableVideo)
  }, [isVideoTab, previewAll.hasAnyPlayableVideo])

  return (
    <div className={styles.panel}>
      <div className={styles.topbar}>
        <div className={styles.tabs} role="tablist" aria-label="工作区切换">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "shotlist" ? styles.tabActive : ""}`}
            onClick={() => {
              if (previewAllActive) previewAll.stopPreviewAll()
              onTabChange("shotlist")
            }}
          >
            Shotlist
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "image" ? styles.tabActive : ""}`}
            onClick={() => {
              if (previewAllActive) previewAll.stopPreviewAll()
              onTabChange("image")
            }}
          >
            Image
          </button>
          <button type="button" className={`${styles.tab} ${activeTab === "video" ? styles.tabActive : ""}`} onClick={() => onTabChange("video")}>
            Video
          </button>
        </div>

        <div className={styles.actions}>
          {taskList.length > 0 ? (
            <div className={styles.taskBadge} aria-label="生成任务">
              <LoaderCircle size={16} className={styles.taskBadgeIcon} />
              {taskList.filter((t) => t.status === "running" || t.status === "queued").length > 0 ? "生成中" : taskList.filter((t) => t.status === "failed").length > 0 ? "有失败" : "已完成"}
              <span className={styles.taskBadgeCount}>{taskList.filter((t) => t.status === "running" || t.status === "queued").length}</span>
            </div>
          ) : null}
          {isVideoTab ? (
            <button type="button" className={styles.actionBtn} onClick={handlePreviewAllClick} disabled={!previewAllActive && !hasAnyPlayableVideo}>
              <Play size={16} />
              {previewAllActive ? "停止预览" : "全片预览"}
            </button>
          ) : null}
          {isVideoTab && previewAllActive ? (
            <button type="button" className={styles.actionBtn} onClick={previewAll.togglePreviewAllPlaying}>
              {previewAllPlaying ? <Pause size={16} /> : <Play size={16} />}
              {previewAllPlaying ? "暂停" : "播放"}
            </button>
          ) : null}
          {isVideoTab ? (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => onAssembleVideo?.()}
              disabled={Boolean(assemblingVideo) || !(canAssemble ?? hasAnyShotVideo)}
            >
              <Download size={16} />
              {assemblingVideo ? "合成中..." : "生成成片"}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.canvas}>
        {taskList.length > 0 ? (
          <div className={styles.taskPanel} aria-label="任务队列">
            <div className={styles.taskHeader}>
              <div className={styles.taskTitle}>任务</div>
              <button
                type="button"
                className={styles.taskActionBtn}
                onClick={() => onTaskAction?.({ kind: "draft", text: "我想重做其中失败/不满意的素材，优先从第N个开始。" })}
              >
                发起调整
              </button>
            </div>
            <div className={styles.taskList}>
              {taskList.slice(0, 6).map((t) => (
                <div key={t.id} className={styles.taskRow}>
                  <div className={styles.taskStatusIcon} aria-hidden="true">
                    {t.status === "running" || t.status === "queued" ? (
                      <LoaderCircle size={16} className={styles.taskSpin} />
                    ) : t.status === "failed" ? (
                      <XCircle size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                  </div>
                  <div className={styles.taskText} title={t.message ? `${t.title}\n${t.message}` : t.title}>
                    {t.title}
                  </div>
                  {t.status === "failed" ? (
                    <button
                      type="button"
                      className={styles.taskActionBtn}
                      onClick={() => {
                        const kindLabel = t.kind === "reference_image" ? "参考图" : t.kind === "first_frame" ? "首帧" : "视频片段"
                        const suffix = t.targetOrdinal ? ` #${t.targetOrdinal}` : ""
                        onTaskAction?.({ kind: "send", text: `重做${kindLabel}${suffix}`.trim(), meta: { kind: t.kind, ...(t.targetOrdinal ? { targetOrdinal: t.targetOrdinal } : {}) } })
                      }}
                      aria-label="重试该任务"
                    >
                      <PenLine size={14} />
                      重试
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className={styles.stage}>
          <div className={styles.stageContent}>
            <div className={styles.stagePane}>
              {activeTab === "shotlist" ? (
                isShotlistLoading ? (
                  <div>
                    <div className={styles.emptyTitle}>Shotlist Loading…</div>
                    <div className={styles.emptySub}>正在加载或生成镜头表。</div>
                  </div>
                ) : selected ? (
                  <div className={styles.shotDetailFill} aria-label="分镜详情">
                    <div className={styles.shotDetailHeader}>
                      <div className={styles.shotDetailTitle}>Shot {String(selected.sequence).padStart(2, "0")}</div>
                    </div>
                    <div className={`${styles.shotDetailBody} ${selectedScriptKv || selectedScriptText ? "" : styles.shotDetailBodyCenter}`}>
                      {selectedScriptKv ? (
                        <div className={styles.shotDetailKv}>
                          {selectedScriptKv.map((row, idx) => (
                            <div key={`${row.key}_${idx}`} className={styles.shotDetailKvRow}>
                              <div className={styles.shotDetailKvKey} title={row.key}>
                                {row.key}
                              </div>
                              <div className={styles.shotDetailKvVal}>{row.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : selectedScriptText ? (
                        <pre className={styles.shotDetailPre}>{selectedScriptText}</pre>
                      ) : (
                        <div className={styles.shotDetailText}>{selected.storyboardText}</div>
                      )}
                    </div>
                  </div>
                ) : shots.length === 0 ? (
                  <div>
                    <div className={styles.emptyTitle}>暂无 Shotlist</div>
                    <div className={styles.emptySub}>请在左侧 Creative Brief 中点击“生成 Shotlist”。</div>
                  </div>
                ) : (
                  <div className={styles.shotlist} aria-label="镜头表">
                    {shots.map((s) => (
                      <div key={s.id} className={styles.shotRow}>
                        <div>
                          <div className={styles.cellLabel}>Shot</div>
                          <div className={styles.cellValue}>{String(s.sequence).padStart(2, "0")}</div>
                        </div>
                        <div>
                          <div className={styles.cellLabel}>Type</div>
                          <div className={styles.cellValue}>Scene</div>
                        </div>
                        <div>
                          <div className={styles.cellLabel}>Description</div>
                          <div className={styles.cellValue}>{s.storyboardText}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "image" ? (
                selected ? (
                  selectedImage.url ? (
                    <div className={styles.selectedImageWrap} aria-label="分镜图片">
                      <img className={styles.selectedImage} src={selectedImage.url} alt={`shot_${selected.sequence}_image`} />
                      <button type="button" className={styles.imageActionBtn} aria-label="编辑/查看提示词" title="编辑/查看提示词" onClick={openPrompt}>
                        <PenLine size={16} />
                      </button>
                      {promptOpen ? (
                        <div className={styles.promptOverlay} role="dialog" aria-label="提示词">
                          <div className={styles.promptDialog}>
                            <div className={styles.promptHeader}>
                              <div className={styles.promptTitle}>Shot {String(selected.sequence).padStart(2, "0")} 提示词</div>
                              <button type="button" className={styles.promptCloseBtn} aria-label="关闭" onClick={() => setPromptOpen(false)}>
                                ×
                              </button>
                            </div>
                            <textarea className={styles.promptTextarea} value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} />
                            <div className={styles.promptActions}>
                              <button
                                type="button"
                                className={styles.promptBtn}
                                onClick={() => {
                                  try {
                                    void navigator.clipboard.writeText(promptDraft || "")
                                  } catch {}
                                }}
                              >
                                复制提示词
                              </button>
                              <a className={`${styles.promptBtn} ${styles.promptBtnPrimary}`} href={selectedImage.url} target="_blank" rel="noreferrer">
                                查看原图
                              </a>
                            </div>
                          </div>
                          <button type="button" className={styles.promptBackdrop} aria-label="关闭遮罩" onClick={() => setPromptOpen(false)} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <div className={styles.emptyTitle}>该分镜暂无图片</div>
                      <div className={styles.emptySub}>生成首帧或关键帧后会在这里展示。</div>
                    </div>
                  )
                ) : imageList.length === 0 ? (
                  <div>
                    <div className={styles.emptyTitle}>暂无图片</div>
                    <div className={styles.emptySub}>等待智能体输出参考图，或在画布的“参考图生成”步骤里生成。</div>
                  </div>
                ) : (
                  <div className={styles.assetGrid} aria-label="图片列表">
                    {imageList.map((img, idx) => (
                      <div key={`${img.url}_${idx}`} className={styles.assetCard}>
                        <img className={styles.assetThumb} src={img.url} alt={img.name || img.description || img.category || "image"} />
                        <div className={styles.assetMeta}>
                          {img.name ? <div className={styles.assetLine}>{img.name}</div> : null}
                          {img.category ? (
                            <div className={styles.assetLine}>
                              类型：
                              {img.category === "role" ? "角色" : img.category === "background" ? "背景" : img.category === "item" ? "物品" : img.category}
                            </div>
                          ) : null}
                          {img.description ? <div className={styles.assetLine}>{img.description}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                previewAllActive ? (
                  <div className={styles.selectedVideoWrap} aria-label="全片预览">
                    <PreviewAllPlayer
                      activeTitle={"全片预览"}
                      currentItem={currentItem}
                      currentItemDurationSeconds={currentItemDurationSeconds}
                      previewAllPlaying={previewAllPlaying}
                      previewAllLocalTime={previewAllLocalTime}
                      previewAllElapsedSeconds={previewAllElapsedSeconds}
                      previewAllSeeking={previewAllSeeking}
                      nextPreloadVideoSrc={nextPreloadVideoSrc}
                      timelineAudioClips={timelineAudioClips}
                      onAdvancePreviewAll={previewAll.advancePreviewAll}
                      onUpdatePreviewAllLocalTime={previewAll.updatePreviewAllLocalTime}
                      onMediaAspect={() => {}}
                      onStopPreviewAll={previewAll.stopPreviewAll}
                    />
                  </div>
                ) : selected ? (
                  selectedVideoUrl ? (
                    <div className={styles.selectedVideoWrap} aria-label="分镜视频">
                      <video className={styles.selectedVideo} src={selectedVideoUrl} controls playsInline />
                    </div>
                  ) : (
                    <div>
                      <div className={styles.emptyTitle}>该分镜暂无视频</div>
                      <div className={styles.emptySub}>生成视频片段后会在这里展示。</div>
                    </div>
                  )
                ) : finalVideoUrl ? (
                  <div className={styles.selectedVideoWrap} aria-label="成片预览">
                    <video className={styles.selectedVideo} src={String(finalVideoUrl)} controls playsInline />
                  </div>
                ) : videoList.length === 0 ? (
                  <div>
                    <div className={styles.emptyTitle}>暂无视频</div>
                    <div className={styles.emptySub}>等待智能体输出视频片段，或在画布的“视频生成”步骤里生成。</div>
                  </div>
                ) : (
                  <div className={styles.videoList} aria-label="视频列表">
                    {videoList.map((v, idx) => (
                      <div key={`${v.url}_${idx}`} className={styles.videoCard}>
                        <video className={styles.videoPlayer} src={v.url} controls playsInline />
                        <div className={styles.videoMeta}>
                          {v.title ? <div className={styles.videoTitle}>{v.title}</div> : null}
                          {v.duration ? <div className={styles.videoSub}>时长：{v.duration}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
