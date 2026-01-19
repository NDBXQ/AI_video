import { type ReactElement, useEffect, useMemo, useState } from "react"
import styles from "./ChipEditModal.module.css"

type ChipEditModalProps = {
  open: boolean
  title: string
  placeholder: string
  optionLabels?: { left: string; right: string }
  defaultOption?: "left" | "right"
  onSubmit: (value: string, option: "left" | "right") => void
  onClose: () => void
}

export function ChipEditModal({
  open,
  title,
  placeholder,
  optionLabels,
  defaultOption = "left",
  onSubmit,
  onClose
}: ChipEditModalProps): ReactElement | null {
  const [value, setValue] = useState("")
  const [option, setOption] = useState<"left" | "right">(defaultOption)

  const showOption = useMemo(() => Boolean(optionLabels), [optionLabels])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "Enter") {
        const trimmed = value.trim()
        if (!trimmed) return
        onSubmit(trimmed, option)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, onSubmit, open, option, value])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const trimmed = value.trim()

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
          {showOption && (
            <div className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${option === "left" ? styles.segmentActive : ""}`}
                onClick={() => setOption("left")}
              >
                {optionLabels?.left}
              </button>
              <button
                type="button"
                className={`${styles.segment} ${option === "right" ? styles.segmentActive : ""}`}
                onClick={() => setOption("right")}
              >
                {optionLabels?.right}
              </button>
            </div>
          )}
          <input
            className={styles.input}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.footer}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => trimmed && onSubmit(trimmed, option)}
            disabled={!trimmed}
            style={{ opacity: trimmed ? 1 : 0.6, cursor: trimmed ? "pointer" : "not-allowed" }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
