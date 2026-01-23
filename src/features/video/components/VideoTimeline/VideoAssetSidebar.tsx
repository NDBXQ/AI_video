import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./VideoAssetSidebar.module.css"
import { type Asset, type AudioAsset, type MediaAsset, type TimelineSegment, type VideoAsset, ASSET_MIME } from "../../utils/timelineUtils"

export function VideoAssetSidebar({
  onAssetsChange,
  videoSegments
}: {
  onAssetsChange?: (assets: { audio: AudioAsset[]; media: MediaAsset[] }) => void
  videoSegments?: TimelineSegment[]
}): ReactElement {
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([])
  const [mediaAssets] = useState<MediaAsset[]>([{ id: "media-1", name: "贴纸素材（示例）", kind: "media" }])
  const videoAssets = useMemo<VideoAsset[]>(() => {
    const list = videoSegments ?? []
    return list
      .filter((s) => Boolean((s.videoSrc ?? "").trim()))
      .map((s) => ({ id: s.id, name: s.title, kind: "video" as const, src: s.videoSrc ?? undefined, durationSeconds: s.durationSeconds ?? null }))
  }, [videoSegments])

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

  useEffect(() => {
    void loadAudio()
  }, [loadAudio])

  useEffect(() => {
    onAssetsChange?.({ audio: audioAssets, media: mediaAssets })
  }, [audioAssets, mediaAssets, onAssetsChange])

  const startDrag = (asset: Asset) => (e: React.DragEvent) => {
    e.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset))
    e.dataTransfer.setData("text/plain", JSON.stringify(asset))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div className={styles.assetPanel} aria-label="素材面板">
      <div className={styles.assetHeader}>素材</div>

      <div className={styles.assetSection}>
        <div className={styles.assetSectionTitle}>视频素材</div>
        <div className={styles.assetList}>
          {videoAssets.map((a) => (
            <div key={a.id} className={styles.assetItem} draggable onDragStart={startDrag(a)} title={a.name}>
              {a.name}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.assetSection}>
        <div className={styles.assetSectionTitle}>音频素材</div>
        <label className={styles.uploadBtn}>
          <input
            type="file"
            accept="audio/*"
            className={styles.uploadInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const doUpload = async () => {
                const form = new FormData()
                form.set("file", file)
                form.set("type", "audio")
                form.set("name", file.name.replace(/\.[^/.]+$/, ""))
                const res = await fetch("/api/library/public-resources/upload", { method: "POST", body: form })
                const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
                if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
              }
              void doUpload()
                .then(() => loadAudio())
                .catch(() => {})
              e.target.value = ""
            }}
          />
          添加音频
        </label>
        <div className={styles.assetList}>
          {audioAssets.map((a) => (
            <div key={a.id} className={styles.assetItem} draggable onDragStart={startDrag(a)} title={a.name}>
              {a.name}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.assetSection}>
        <div className={styles.assetSectionTitle}>素材</div>
        <div className={styles.assetList}>
          {mediaAssets.map((a) => (
            <div key={a.id} className={styles.assetItem} draggable onDragStart={startDrag(a)} title={a.name}>
              {a.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
