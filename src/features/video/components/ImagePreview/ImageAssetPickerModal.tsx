import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import styles from "./ImageAssetPickerModal.module.css"

type TabKey = "library" | "upload"

type PublicResourceRow = {
  id: string
  name: string
  type?: string
  previewUrl?: string | null
  originalUrl?: string | null
}

function mapCategoryToPublicType(category: string): string {
  if (category === "role") return "character"
  if (category === "item") return "props"
  return "background"
}

export function ImageAssetPickerModal({
  open,
  title,
  entityName,
  storyboardId,
  category,
  onPicked,
  onClose
}: {
  open: boolean
  title: string
  entityName?: string
  storyboardId: string
  category: string
  onPicked: (v: { url: string; thumbnailUrl: string | null; generatedImageId: string }) => void
  onClose: () => void
}): ReactElement | null {
  const [tab, setTab] = useState<TabKey>("library")
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PublicResourceRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const publicType = useMemo(() => mapCategoryToPublicType(category), [category])

  useEffect(() => {
    if (!open) return
    setTab("library")
    setError(null)
  }, [open])

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/library/public-resources/list?type=${encodeURIComponent(publicType)}&limit=200&offset=0`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { items?: any[] }; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const raw = Array.isArray(json.data?.items) ? json.data?.items ?? [] : []
      const next = raw
        .map((row) => ({
          id: String(row.id ?? ""),
          name: typeof row.name === "string" ? row.name : "",
          type: typeof row.type === "string" ? row.type : undefined,
          previewUrl: typeof row.previewUrl === "string" ? row.previewUrl : null,
          originalUrl: typeof row.originalUrl === "string" ? row.originalUrl : null
        }))
        .filter((v) => v.id && v.name)
      setItems(next)
    } catch (e) {
      const anyErr = e as { message?: string }
      setItems([])
      setError(anyErr?.message ?? "加载素材库失败")
    } finally {
      setLoading(false)
    }
  }, [publicType])

  useEffect(() => {
    if (!open) return
    if (tab !== "library") return
    void loadLibrary()
  }, [loadLibrary, open, tab])

  const pickFromLibrary = useCallback(
    async (publicResourceId: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/video-creation/images/import-public-resource", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyboardId, publicResourceId, name: entityName || title, displayName: title, category })
        })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: any; error?: { message?: string } } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const url = typeof json.data?.url === "string" ? json.data.url : ""
        const generatedImageId = typeof json.data?.id === "string" ? json.data.id : ""
        const thumbnailUrl = typeof json.data?.thumbnailUrl === "string" ? json.data.thumbnailUrl : null
        if (!url || !generatedImageId) throw new Error("保存成功但缺少必要字段")
        onPicked({ url, thumbnailUrl, generatedImageId })
        onClose()
      } catch (e) {
        const anyErr = e as { message?: string }
        setError(anyErr?.message ?? "选择素材失败")
      } finally {
        setLoading(false)
      }
    },
    [category, entityName, onClose, onPicked, storyboardId, title]
  )

  const uploadLocal = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("storyboardId", storyboardId)
        form.set("name", entityName || title)
        form.set("displayName", title)
        form.set("category", category)
        const res = await fetch("/api/video-creation/images/upload", { method: "POST", body: form })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: any; error?: { message?: string } } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const url = typeof json.data?.url === "string" ? json.data.url : ""
        const generatedImageId = typeof json.data?.id === "string" ? json.data.id : ""
        const thumbnailUrl = typeof json.data?.thumbnailUrl === "string" ? json.data.thumbnailUrl : null
        if (!url || !generatedImageId) throw new Error("上传成功但缺少必要字段")
        onPicked({ url, thumbnailUrl, generatedImageId })
        onClose()
      } catch (e) {
        const anyErr = e as { message?: string }
        setError(anyErr?.message ?? "上传失败")
      } finally {
        setLoading(false)
      }
    },
    [category, entityName, onClose, onPicked, storyboardId, title]
  )

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="选择素材">
        <div className={styles.header}>
          <div className={styles.title}>选择素材</div>
          <div className={styles.tabs} role="tablist" aria-label="选择方式">
            <button type="button" className={`${styles.tab} ${tab === "library" ? styles.tabActive : ""}`} onClick={() => setTab("library")}>
              素材库
            </button>
            <button type="button" className={`${styles.tab} ${tab === "upload" ? styles.tabActive : ""}`} onClick={() => setTab("upload")}>
              本地上传
            </button>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {tab === "library" ? (
            loading ? (
              <div className={styles.empty}>加载中…</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>暂无可用素材</div>
            ) : (
              <div className={styles.grid} aria-label="素材列表">
                {items.map((it) => (
                  <div key={it.id} className={styles.tile} role="button" tabIndex={0} onClick={() => void pickFromLibrary(it.id)}>
                    <span className={styles.grip} aria-hidden />
                    <span className={styles.tileText} title={it.name}>
                      {it.name}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className={styles.uploadRow} aria-label="本地上传">
              <label className={styles.uploadBtn}>
                <input
                  type="file"
                  accept="image/*"
                  className={styles.uploadInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void uploadLocal(file)
                    e.target.value = ""
                  }}
                  disabled={loading}
                />
                选择文件
              </label>
              <div className={styles.hint}>
                上传后会保存到当前镜头素材（名称使用 {title}），并可在后续预览/生成中复用
              </div>
            </div>
          )}
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      </div>
    </div>
  )
}
