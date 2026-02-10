"use client"

import { useEffect, type ReactElement } from "react"
import { createPortal } from "react-dom"
import styles from "./AgentImagePreviewModal.module.css"

export type AgentPreviewImage = {
  url: string
  alt?: string
  name?: string
  typeLabel?: string
  description?: string
}

export function AgentImagePreviewModal({
  open,
  image,
  onClose,
  showOpenInNewTab = true
}: {
  open: boolean
  image?: AgentPreviewImage | null
  onClose: () => void
  showOpenInNewTab?: boolean
}): ReactElement | null {
  const canPortal = typeof document !== "undefined"

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open || !image?.url) return null

  const content = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="图片预览" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{image.name?.trim() ? image.name : "图片信息"}</div>
          <div className={styles.actions}>
            {showOpenInNewTab ? (
              <a className={styles.linkBtn} href={image.url} target="_blank" rel="noreferrer">
                新标签打开
              </a>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.imageWrap}>
            <img className={styles.image} src={image.url} alt={image.alt ?? image.name ?? image.description ?? "image"} />
          </div>

          {image.name || image.typeLabel || image.description ? (
            <div className={styles.meta}>
              {image.typeLabel ? <div className={styles.metaLine}>类型：{image.typeLabel}</div> : null}
              {image.name ? <div className={styles.metaLine}>名称：{image.name}</div> : null}
              {image.description ? <div className={styles.metaLine}>描述：{image.description}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return canPortal ? createPortal(content, document.body) : content
}
