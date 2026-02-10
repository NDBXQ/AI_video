"use client"

import { useEffect, useId, useRef, type ReactElement } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import styles from "./VideoParamsDrawer.module.css"

export function VideoParamsDrawer({
  open,
  title = "视频参数",
  children,
  onClose
}: {
  open: boolean
  title?: string
  children: ReactElement
  onClose: () => void
}): ReactElement | null {
  const canPortal = typeof document !== "undefined"
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    sheetRef.current?.focus()

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const content = (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={sheetRef} className={styles.sheet} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )

  return canPortal ? createPortal(content, document.body) : content
}

