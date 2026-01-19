import Image from "next/image"
import { type ReactElement, useEffect } from "react"
import styles from "./ImagePreviewModal.module.css"

type ImagePreviewModalProps = {
  open: boolean
  title: string
  imageSrc: string
  onClose: () => void
}

export function ImagePreviewModal({ open, title, imageSrc, onClose }: ImagePreviewModalProps): ReactElement | null {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.frame}>
            <Image src={imageSrc} alt={title} fill unoptimized sizes="(max-width: 1023px) 100vw, 980px" />
          </div>
        </div>
      </div>
    </div>
  )
}

