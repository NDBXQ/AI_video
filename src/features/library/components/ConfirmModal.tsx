"use client"

import type { ReactElement } from "react"
import styles from "./ConfirmModal.module.css"

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = "确认删除",
  cancelText = "取消",
  confirming,
  onConfirm,
  onCancel
}: ConfirmModalProps): ReactElement | null {
  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
        </div>
        <div className={styles.body}>{message}</div>
        <div className={styles.footer}>
          <button type="button" className={styles.btn} onClick={onCancel} disabled={confirming}>
            {cancelText}
          </button>
          <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={onConfirm} disabled={confirming}>
            {confirming ? "删除中..." : confirmText}
          </button>
        </div>
      </div>
    </>
  )
}

