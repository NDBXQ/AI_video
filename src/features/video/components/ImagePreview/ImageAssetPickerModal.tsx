import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import styles from "./ImageAssetPickerModal.module.css"

type TabKey = "library" | "script"

type PublicResourceRow = {
  id: string
  name: string
  type?: string
  previewUrl?: string | null
  originalUrl?: string | null
}

type ScriptAssetRow = {
  id: string
  name: string
  url: string
  thumbnailUrl: string | null
  description: string | null
  prompt: string | null
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
  storyId,
  storyboardId,
  category,
  onPicked,
  onClose
}: {
  open: boolean
  title: string
  entityName?: string
  storyId?: string | null
  storyboardId: string
  category: string
  onPicked: (v: {
    url: string
    thumbnailUrl: string | null
    generatedImageId: string
    entityName?: string | null
    metaTitle?: string | null
    metaDescription?: string | null
  }) => void
  onClose: () => void
}): ReactElement | null {
  const [tab, setTab] = useState<TabKey>("library")
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PublicResourceRow[]>([])
  const [scriptItems, setScriptItems] = useState<ScriptAssetRow[]>([])
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

  const loadScriptAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        limit: "200",
        offset: "0",
        category
      })
      const sid = typeof storyId === "string" ? storyId.trim() : ""
      if (sid) qs.set("storyId", sid)
      else qs.set("storyboardId", storyboardId)
      const res = await fetch(`/api/video-creation/images?${qs.toString()}`, { cache: "no-store" })
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { items?: any[] }; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const raw = Array.isArray(json.data?.items) ? json.data?.items ?? [] : []
      const next = raw
        .map((row) => ({
          id: String(row.id ?? ""),
          name: typeof row.name === "string" ? row.name : "",
          url: typeof row.url === "string" ? row.url : "",
          thumbnailUrl: typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : null,
          description: typeof row.description === "string" ? row.description : null,
          prompt: typeof row.prompt === "string" ? row.prompt : null
        }))
        .filter((v) => v.id && v.url)
      setScriptItems(next)
    } catch (e) {
      const anyErr = e as { message?: string }
      setScriptItems([])
      setError(anyErr?.message ?? "加载脚本素材失败")
    } finally {
      setLoading(false)
    }
  }, [category, storyboardId, storyId])

  useEffect(() => {
    if (!open) return
    if (tab !== "script") return
    void loadScriptAssets()
  }, [loadScriptAssets, open, tab])

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
        const pickedEntityName = typeof json.data?.pickedEntityName === "string" ? json.data.pickedEntityName : null
        const metaTitle = typeof json.data?.pickedTitle === "string" ? json.data.pickedTitle : null
        const metaDescription = typeof json.data?.pickedDescription === "string" ? json.data.pickedDescription : null
        if (!url || !generatedImageId) throw new Error("保存成功但缺少必要字段")
        onPicked({ url, thumbnailUrl, generatedImageId, entityName: pickedEntityName, metaTitle, metaDescription })
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

  const pickFromScriptAssets = useCallback(
    async (sourceGeneratedImageId: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/video-creation/images/import-script-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyboardId,
            sourceGeneratedImageId,
            name: entityName || title,
            displayName: title,
            category
          })
        })
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: any; error?: { message?: string } } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        const url = typeof json.data?.url === "string" ? json.data.url : ""
        const generatedImageId = typeof json.data?.id === "string" ? json.data.id : ""
        const thumbnailUrl = typeof json.data?.thumbnailUrl === "string" ? json.data.thumbnailUrl : null
        const pickedEntityName = typeof json.data?.pickedEntityName === "string" ? json.data.pickedEntityName : null
        const metaTitle = typeof json.data?.pickedTitle === "string" ? json.data.pickedTitle : null
        const metaDescription = typeof json.data?.pickedDescription === "string" ? json.data.pickedDescription : null
        if (!url || !generatedImageId) throw new Error("保存成功但缺少必要字段")
        onPicked({ url, thumbnailUrl, generatedImageId, entityName: pickedEntityName, metaTitle, metaDescription })
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
  const canPortal = typeof document !== "undefined"
  const content = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="选择素材">
        <div className={styles.header}>
          <div className={styles.title}>选择素材</div>
          <div className={styles.tabs} role="tablist" aria-label="选择方式">
            <button type="button" className={`${styles.tab} ${tab === "library" ? styles.tabActive : ""}`} onClick={() => setTab("library")}>
              资源库
            </button>
            <button type="button" className={`${styles.tab} ${tab === "script" ? styles.tabActive : ""}`} onClick={() => setTab("script")}>
              脚本素材
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
                  <button
                    key={it.id}
                    className={styles.tile}
                    type="button"
                    onClick={() => void pickFromLibrary(it.id)}
                    disabled={loading}
                    aria-label={`选择素材：${it.name}`}
                  >
                    <span className={styles.tileText} title={it.name}>
                      {it.name}
                    </span>
                    <span className={styles.thumb} aria-hidden="true">
                      {it.previewUrl || it.originalUrl ? <img className={styles.thumbImg} src={it.previewUrl || it.originalUrl || ""} alt="" /> : <span className={styles.thumbFallback} />}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              <div className={styles.uploadRow} aria-label="上传到脚本素材">
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
                  上传图片
                </label>
                <div className={styles.hint}>上传后会保存到当前脚本素材，并可在后续预览/生成中复用</div>
              </div>
              {loading ? (
                <div className={styles.empty}>加载中…</div>
              ) : scriptItems.length === 0 ? (
                <div className={styles.empty}>暂无可用脚本素材</div>
              ) : (
                <div className={styles.grid} aria-label="脚本素材列表">
                  {scriptItems.map((it) => (
                    <button
                      key={it.id}
                      className={styles.tile}
                      type="button"
                      onClick={() => void pickFromScriptAssets(it.id)}
                      disabled={loading}
                      aria-label={`选择脚本素材：${it.name}`}
                    >
                      <span className={styles.tileText} title={it.name}>
                        {it.name}
                      </span>
                      <span className={styles.thumb} aria-hidden="true">
                        {it.thumbnailUrl || it.url ? <img className={styles.thumbImg} src={it.thumbnailUrl || it.url} alt="" /> : <span className={styles.thumbFallback} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      </div>
    </div>
  )
  return canPortal ? createPortal(content, document.body) : content
}
