import { type ReactElement, useEffect, useState } from "react"
import styles from "./ImagePreviewModal.module.css"
import { startReferenceImageJob, waitReferenceImageJob } from "../utils/referenceImageAsync"
import { ImagePreviewFrame } from "./ImagePreview/ImagePreviewFrame"
import { ImagePreviewSidebar } from "./ImagePreview/ImagePreviewSidebar"
import { type NormalizedRect, normalizeRect } from "../utils/imageEditorUtils"

type ImagePreviewModalProps = {
  open: boolean
  title: string
  imageSrc: string
  generatedImageId?: string
  storyboardId?: string | null
  category?: string | null
  description?: string | null
  prompt?: string | null
  onClose: () => void
}

export function ImagePreviewModal({
  open,
  title,
  imageSrc,
  generatedImageId,
  storyboardId,
  category,
  description,
  prompt,
  onClose,
}: ImagePreviewModalProps): ReactElement | null {
  const [saving, setSaving] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null)
  const [confirmedRect, setConfirmedRect] = useState<NormalizedRect | null>(null)
  const [inpaintLoading, setInpaintLoading] = useState(false)
  const [inpaintError, setInpaintError] = useState<string | null>(null)
  const [publicResourceId, setPublicResourceId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [currentSrc, setCurrentSrc] = useState(imageSrc)
  const [currentGeneratedImageId, setCurrentGeneratedImageId] = useState<string | undefined>(generatedImageId)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [editPrompt, setEditPrompt] = useState("")

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (isEditing) {
        setIsEditing(false)
        setDraftRect(null)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isEditing, onClose, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setSaveDone(false)
    setSaveError(null)
    setRegenerating(false)
    setRegenerateError(null)
    setIsEditing(false)
    setDraftRect(null)
    setConfirmedRect(null)
    setInpaintLoading(false)
    setInpaintError(null)
    setPublicResourceId(null)
    setDeleting(false)
    setDeleteError(null)
    setImageSize(null)
    setCurrentSrc(imageSrc?.trim() ? imageSrc : "")
    setCurrentGeneratedImageId(generatedImageId)
    setEditPrompt("")
  }, [open, imageSrc, generatedImageId])

  useEffect(() => {
    if (!open) return
    if (!currentGeneratedImageId) return
    let cancelled = false
    const run = async () => {
      try {
        const qs = new URLSearchParams({ generatedImageId: currentGeneratedImageId })
        const res = await fetch(`/api/library/public-resources/lookup?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
        })
        const json = (await res.json().catch(() => null)) as {
          ok: boolean
          data?: { exists?: boolean; id?: string | null }
          error?: { message?: string }
        } | null
        if (!res.ok || !json?.ok) return
        const id = json.data?.id ?? null
        if (cancelled) return
        setPublicResourceId(id)
        if (id) setSaveDone(true)
      } catch {}
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [currentGeneratedImageId, open])

  const updateRect = (r: NormalizedRect | null) => {
    if (isEditing) setDraftRect(r)
    else setConfirmedRect(r)
  }

  const handleRectChange = (r: NormalizedRect | null) => {
    updateRect(r)
  }
  
  const handleEditEnd = () => {
     if (isEditing && draftRect) {
         if (draftRect.w >= 0.01 && draftRect.h >= 0.01) {
             setConfirmedRect(normalizeRect(draftRect))
         }
         setIsEditing(false)
         setDraftRect(null)
     } else {
         setIsEditing(false)
         setDraftRect(null)
     }
  }

  const handleEditStart = () => {
      setInpaintError(null)
      setIsEditing(true)
      setDraftRect(null)
      setConfirmedRect(null)
  }

  const handleClearSelection = () => {
      setConfirmedRect(null)
      setIsEditing(true)
  }

  const handleSave = async () => {
    if (!currentGeneratedImageId) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch("/api/library/public-resources/import-generated-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedImageId: currentGeneratedImageId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: any; error?: { message?: string } }
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const id = typeof json?.data?.id === "string" ? json.data.id : null
      if (id) setPublicResourceId(id)
      setSaveDone(true)
    } catch (e) {
      const anyErr = e as { message?: string }
      setSaveError(anyErr?.message ?? "入库失败")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!publicResourceId) return
    const ok = window.confirm("确定从公共素材库删除该图片吗？")
    if (!ok) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/library/public-resources/${encodeURIComponent(publicResourceId)}`, {
        method: "DELETE",
      })
      const json = (await res.json().catch(() => null)) as {
        ok: boolean
        error?: { message?: string }
      } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      setPublicResourceId(null)
      setSaveDone(false)
    } catch (e) {
      const anyErr = e as { message?: string }
      setDeleteError(anyErr?.message ?? "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const handleRegenerate = async () => {
    if (!prompt || !storyboardId) return
    setRegenerating(true)
    setRegenerateError(null)
    try {
      const normalizedCategory: "background" | "role" | "item" =
        category === "role" || category === "item" || category === "background" ? category : "background"
        
      const jobId = await startReferenceImageJob({
        storyboardId,
        forceRegenerate: true,
        prompts: [
          {
            name: title,
            category: normalizedCategory,
            description: description ?? undefined,
            prompt,
            generatedImageId: currentGeneratedImageId,
          },
        ],
      })
      const snap = await waitReferenceImageJob(jobId)
      const result = snap.results[0]
      const url = typeof result?.url === "string" ? result.url : ""
      const id = typeof result?.id === "string" ? result.id : currentGeneratedImageId
      if (!url) throw new Error("重新生成成功但缺少图片 URL")
      setCurrentSrc(url)
      if (id) setCurrentGeneratedImageId(id)
      window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId } }))
    } catch (e) {
      const anyErr = e as { message?: string }
      setRegenerateError(anyErr?.message ?? "重新生成失败")
    } finally {
      setRegenerating(false)
    }
  }

  const handleGenerate = async () => {
    if (!confirmedRect) return
    setInpaintLoading(true)
    setInpaintError(null)
    try {
      const res = await fetch("/api/video-creation/images/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: currentSrc,
          selection: confirmedRect,
          storyboardId: storyboardId ?? null,
          generatedImageId: currentGeneratedImageId ?? null,
          prompt: editPrompt,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        ok: boolean
        data?: { url?: string; generatedImageId?: string }
        error?: { message?: string }
      } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const nextUrl = typeof json.data?.url === "string" ? json.data.url : ""
      if (!nextUrl) throw new Error("生成成功但缺少图片 URL")
      const nextId = typeof json.data?.generatedImageId === "string" ? json.data.generatedImageId : ""
      setCurrentSrc(nextUrl)
      if (nextId) setCurrentGeneratedImageId(nextId)
      setConfirmedRect(null)
      setIsEditing(false)
      setEditPrompt("")
      if (storyboardId)
        window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId } }))
    } catch (err) {
      const anyErr = err as { message?: string }
      setInpaintError(anyErr?.message ?? "生成失败")
    } finally {
      setInpaintLoading(false)
    }
  }

  const handleExitEdit = () => {
      setIsEditing(false)
      setDraftRect(null)
      setConfirmedRect(null)
      setEditPrompt("")
  }

  if (!open) return null
  const displayDescription = (description ?? "").trim() || (prompt ?? "").trim() || "暂无描述"

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <ImagePreviewFrame
            src={currentSrc}
            alt={title}
            isEditing={isEditing}
            rect={isEditing ? draftRect : confirmedRect}
            onRectChange={handleRectChange}
            onEditStart={handleEditStart}
            onEditEnd={handleEditEnd}
            onClearSelection={handleClearSelection}
            loading={inpaintLoading}
            imageSize={imageSize}
            setImageSize={setImageSize}
        />
        
        <ImagePreviewSidebar
            title={title}
            description={displayDescription}
            isEditing={isEditing}
            editPrompt={editPrompt}
            onEditPromptChange={setEditPrompt}
            hasSelection={Boolean(confirmedRect)}
            onGenerate={handleGenerate}
            onExitEdit={handleExitEdit}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            loading={inpaintLoading}
            regenerating={regenerating}
            saving={saving}
            saveDone={saveDone}
            saveError={saveError}
            regenerateError={regenerateError}
            deleteError={deleteError}
            inpaintError={inpaintError}
            onClose={onClose}
            canRegenerate={Boolean(prompt && storyboardId)}
            publicResourceId={publicResourceId}
            onDelete={handleDelete}
            deleting={deleting}
        />
      </div>
    </div>
  )
}
