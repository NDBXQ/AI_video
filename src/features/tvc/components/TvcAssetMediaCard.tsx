"use client"

import { Eye, X } from "lucide-react"
import { useMemo, useState, type ReactElement } from "react"
import styles from "./TvcAssetMediaCard.module.css"
import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal"
import { AspectRatio } from "@/shared/ui/shadcn/aspect-ratio"

export function TvcAssetMediaCard(props: {
  mediaType: "image" | "video"
  title: string
  typeLabel?: string
  name?: string
  description?: string
  url?: string
  thumbnailUrl?: string
  statusTextWhenMissing?: string
  onOpen?: () => void
  onViewInfo?: () => void
  onDelete?: () => void
}): ReactElement {
  const { mediaType, title, typeLabel, name, url, thumbnailUrl, statusTextWhenMissing, onOpen, onViewInfo, onDelete } = props
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null)

  const openUrl = useMemo(() => (url ?? "").trim(), [url])
  const previewUrl = useMemo(() => (thumbnailUrl ?? openUrl).trim(), [thumbnailUrl, openUrl])
  const videoPoster = useMemo(() => (mediaType === "video" ? (thumbnailUrl ?? "").trim() : ""), [mediaType, thumbnailUrl])
  const clickable = Boolean(mediaType === "image" && openUrl && onOpen)
  const displayName = useMemo(() => (String(name ?? "").trim() ? String(name).trim() : title), [name, title])
  const fallbackRatio = useMemo(() => (mediaType === "video" ? 16 / 9 : 4 / 3), [mediaType])
  const ratio = measuredRatio ?? fallbackRatio

  return (
    <div
      className={`${styles.card} ${clickable ? styles.cardClickable : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onOpen?.()
              }
            }
          : undefined
      }
      aria-label={clickable ? `预览：${title}` : undefined}
    >
      <div className={styles.preview}>
        <AspectRatio ratio={ratio}>
          {openUrl ? (
            mediaType === "video" ? (
              <video
                className={`${styles.media} ${styles.mediaVideo}`}
                controls
                playsInline
                preload="metadata"
                poster={videoPoster || undefined}
                src={openUrl}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget
                  const w = Number(el.videoWidth)
                  const h = Number(el.videoHeight)
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return
                  setMeasuredRatio(w / h)
                }}
              />
            ) : (
              <img
                className={`${styles.media} ${styles.mediaImage}`}
                src={previewUrl}
                alt={displayName}
                onLoad={(e) => {
                  const el = e.currentTarget
                  const w = Number(el.naturalWidth)
                  const h = Number(el.naturalHeight)
                  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return
                  setMeasuredRatio(w / h)
                }}
              />
            )
          ) : (
            <div className={styles.placeholder}>{statusTextWhenMissing || "素材同步中…"}</div>
          )}
        </AspectRatio>
        {onViewInfo || onDelete ? (
          <div className={styles.cornerActions}>
            {onViewInfo ? (
              <button
                type="button"
                className={styles.cornerBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  onViewInfo()
                }}
                aria-label="查看图片信息"
                title="查看信息"
              >
                <Eye size={16} />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className={`${styles.cornerBtn} ${styles.cornerBtnDanger}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteOpen(true)
                }}
                aria-label="删除图片"
                title="删除"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.metaRow}>
          {typeLabel ? (
            <div className={styles.typePill} title={typeLabel}>
              {typeLabel}
            </div>
          ) : null}
        </div>
        <div className={styles.name} title={displayName}>
          {displayName}
        </div>
      </div>
      {onDelete ? (
        <ConfirmDeleteModal
          open={deleteOpen}
          itemName={displayName}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false)
            onDelete()
          }}
        />
      ) : null}
    </div>
  )
}
