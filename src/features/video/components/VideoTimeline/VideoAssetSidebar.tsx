import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./VideoAssetSidebar.module.css"
import { type Asset, type AudioAsset, type MediaAsset, type TimelineSegment, type VideoAsset, ASSET_MIME } from "../../utils/timelineUtils"

export type VideoAssetGroup = {
  outlineId: string
  label: string
  segments: Array<TimelineSegment & { durationSeconds?: number | null }>
}

export function VideoAssetSidebar({
  onAssetsChange,
  videoSegments,
  videoGroups
}: {
  onAssetsChange?: (assets: { audio: AudioAsset[]; media: MediaAsset[] }) => void
  videoSegments?: TimelineSegment[]
  videoGroups?: VideoAssetGroup[]
}): ReactElement {
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image">("video")
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([])
  const [videoLibraryAssets, setVideoLibraryAssets] = useState<VideoAsset[]>([])
  const [mediaAssets] = useState<MediaAsset[]>([{ id: "media-1", name: "贴纸素材（示例）", kind: "media" }])
  const videoAssets = useMemo<VideoAsset[]>(() => {
    const list = videoSegments ?? []
    return list
      .filter((s) => Boolean((s.videoSrc ?? "").trim()))
      .map((s) => ({ id: s.id, name: s.title, kind: "video" as const, src: s.videoSrc ?? undefined, durationSeconds: s.durationSeconds ?? null }))
  }, [videoSegments])

  const normalizedGroups = useMemo(() => {
    const groups = videoGroups ?? []
    return groups
      .map((g) => ({
        ...g,
        segments: (g.segments ?? []).filter((s) => Boolean((s.videoSrc ?? "").trim()))
      }))
      .filter((g) => g.segments.length > 0)
  }, [videoGroups])

  const uploadPublicResource = useCallback(async (file: File, type: "audio" | "video") => {
    const form = new FormData()
    form.set("file", file)
    form.set("type", type)
    form.set("name", file.name.replace(/\.[^/.]+$/, ""))
    const res = await fetch("/api/library/public-resources/upload", { method: "POST", body: form })
    const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, [])

  const loadAudio = useCallback(async () => {
    try {
      const res = await fetch("/api/library/public-resources/list?type=audio&limit=200&offset=0", { cache: "no-store" })
      const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
      if (!res.ok || !json?.ok || !Array.isArray(json.data?.items)) {
        setAudioAssets([])
        return
      }
      const next = json.data.items
        .map((row) => ({
          id: String(row.id),
          name: typeof row.name === "string" ? row.name : "audio",
          kind: "audio" as const,
          src: typeof row.originalUrl === "string" ? row.originalUrl : typeof row.previewUrl === "string" ? row.previewUrl : undefined
        }))
        .filter((v) => v.id && v.name)
      setAudioAssets(next)
    } catch {
      setAudioAssets([])
    }
  }, [])

  const loadVideoLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library/public-resources/list?type=video&limit=200&offset=0", { cache: "no-store" })
      const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
      if (!res.ok || !json?.ok || !Array.isArray(json.data?.items)) {
        setVideoLibraryAssets([])
        return
      }
      const next = json.data.items
        .map((row) => {
          const src = typeof row.originalUrl === "string" ? row.originalUrl : typeof row.previewUrl === "string" ? row.previewUrl : undefined
          return {
            id: String(row.id),
            name: typeof row.name === "string" ? row.name : "video",
            kind: "video" as const,
            src,
            durationSeconds: null
          }
        })
        .filter((v) => v.id && v.name && v.src)
      setVideoLibraryAssets(next)
    } catch {
      setVideoLibraryAssets([])
    }
  }, [])

  useEffect(() => {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        void loadAudio()
        void loadVideoLibrary()
      })
      return
    }
    void Promise.resolve().then(() => Promise.all([loadAudio(), loadVideoLibrary()]))
  }, [loadAudio, loadVideoLibrary])

  useEffect(() => {
    onAssetsChange?.({ audio: audioAssets, media: mediaAssets })
  }, [audioAssets, mediaAssets, onAssetsChange])

  const startDrag = (asset: Asset) => (e: React.DragEvent) => {
    e.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset))
    e.dataTransfer.setData("text/plain", JSON.stringify(asset))
    e.dataTransfer.effectAllowed = "copy"
  }

  const renderChip = (asset: Asset) => (
    <div key={asset.id} className={styles.chipItem} draggable onDragStart={startDrag(asset)} title={asset.name}>
      <span className={styles.chipGrip} aria-hidden />
      <span className={styles.chipText}>{asset.name}</span>
    </div>
  )

  return (
    <div className={styles.assetPanel} aria-label="素材面板">
      <div className={styles.topTabs} role="tablist" aria-label="素材类型">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "video"}
          className={`${styles.topTab} ${activeTab === "video" ? styles.topTabActive : ""}`}
          onClick={() => setActiveTab("video")}
        >
          视频
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "audio"}
          className={`${styles.topTab} ${activeTab === "audio" ? styles.topTabActive : ""}`}
          onClick={() => setActiveTab("audio")}
        >
          音频
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "image"}
          className={`${styles.topTab} ${activeTab === "image" ? styles.topTabActive : ""}`}
          onClick={() => setActiveTab("image")}
        >
          图片
        </button>
      </div>

      {activeTab === "video" ? (
        <div className={styles.tabBody} aria-label="视频素材">
          <div className={styles.splitBlock} aria-label="脚本视频">
            <div className={styles.splitLabel}>脚本</div>
            <div className={styles.splitContent}>
              {normalizedGroups.length > 0 ? (
                <div className={styles.groupList} aria-label="按剧集分组的视频素材">
                  {normalizedGroups.map((group) => (
                    <div key={group.outlineId} className={styles.groupRow}>
                      <div className={styles.groupTag} title={group.label}>
                        {group.label}
                      </div>
                      <div className={styles.groupChips}>
                        {group.segments.map((seg) => {
                          const asset: VideoAsset = {
                            id: seg.id,
                            name: `${group.label} ${seg.title}`.trim(),
                            kind: "video",
                            src: seg.videoSrc ?? undefined,
                            durationSeconds: seg.durationSeconds ?? null
                          }
                          return (
                            <div key={asset.id} className={styles.chipItem} draggable onDragStart={startDrag(asset)} title={asset.name}>
                              <span className={styles.chipGrip} aria-hidden />
                              <span className={styles.chipText}>{seg.title}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.chipList}>
                  {videoAssets.length > 0 ? videoAssets.map((a) => renderChip(a)) : <div className={styles.emptyHint}>暂无脚本视频</div>}
                </div>
              )}
            </div>
          </div>

          <div className={styles.splitBlock} aria-label="素材库视频">
            <div className={styles.splitLabel}>素材库</div>
            <div className={styles.splitContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.assetSectionTitle}>视频</div>
                <label className={styles.uploadBtn}>
                  <input
                    type="file"
                    accept="video/*"
                    className={styles.uploadInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void uploadPublicResource(file, "video")
                        .then(() => loadVideoLibrary())
                        .catch(() => {})
                      e.target.value = ""
                    }}
                  />
                  添加
                </label>
              </div>

              <div className={styles.chipList} aria-label="素材库视频列表">
                {videoLibraryAssets.length > 0 ? videoLibraryAssets.map((a) => renderChip(a)) : <div className={styles.emptyHint}>暂无素材库视频</div>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "audio" ? (
        <div className={styles.tabBody} aria-label="音频素材">
          <div className={styles.splitBlock} aria-label="脚本音频">
            <div className={styles.splitLabel}>脚本</div>
            <div className={styles.splitContent}>
              <div className={styles.emptyHint}>暂无脚本音频</div>
            </div>
          </div>

          <div className={styles.splitBlock} aria-label="素材库音频">
            <div className={styles.splitLabel}>素材库</div>
            <div className={styles.splitContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.assetSectionTitle}>音频</div>
                <label className={styles.uploadBtn}>
                  <input
                    type="file"
                    accept="audio/*"
                    className={styles.uploadInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void uploadPublicResource(file, "audio")
                        .then(() => loadAudio())
                        .catch(() => {})
                      e.target.value = ""
                    }}
                  />
                  添加
                </label>
              </div>
              <div className={styles.audioList}>
                {audioAssets.length > 0 ? (
                  audioAssets.map((a) => (
                    <div key={a.id} className={styles.audioItem} draggable onDragStart={startDrag(a)} title={a.name}>
                      <span className={styles.audioGrip} aria-hidden />
                      <span className={styles.audioText}>{a.name}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyHint}>暂无素材库音频</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "image" ? (
        <div className={styles.tabBody} aria-label="图片素材">
          <div className={styles.splitBlock} aria-label="脚本图片">
            <div className={styles.splitLabel}>脚本</div>
            <div className={styles.splitContent}>
              <div className={styles.emptyHint}>暂无脚本图片</div>
            </div>
          </div>

          <div className={styles.splitBlock} aria-label="素材库图片">
            <div className={styles.splitLabel}>素材库</div>
            <div className={styles.splitContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.assetSectionTitle}>图片</div>
              </div>
              <div className={styles.chipList}>
                {mediaAssets.length > 0 ? mediaAssets.map((a) => renderChip(a)) : <div className={styles.emptyHint}>暂无素材库图片</div>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
