import { type ReactElement, useEffect, useState } from "react"
import styles from "./StoryboardTextModal.module.css"

type StoryboardTextModalProps = {
  open: boolean
  title: string
  initialValue: string
  saving?: boolean
  error?: string | null
  onSave: (value: string) => void
  onClose: () => void
}

export function StoryboardTextModal({
  open,
  title,
  initialValue,
  saving = false,
  error = null,
  onSave,
  onClose
}: StoryboardTextModalProps): ReactElement | null {
  const [value, setValue] = useState(() => initialValue ?? "")

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      const isEnter = e.key === "Enter"
      const isSaveKey = (e.ctrlKey || e.metaKey) && isEnter
      if (isSaveKey) onSave(value)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, onSave, open, value])

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
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>{title}</h3>
            <span className={styles.subtitle}>支持换行，⌘/Ctrl + Enter 保存</span>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            rows={10}
          />
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
        <div className={styles.footer}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => onSave(value)}
            disabled={saving}
            style={{ opacity: saving ? 0.75 : 1, cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}
