"use client"

import type { ReactElement } from "react"
import { AlertTriangle, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/shared/ui/shadcn/dialog"
import { Button } from "@/shared/ui/shadcn/button"
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
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return
        if (confirming) return
        onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader className={styles.header}>
          <div className={styles.icon}>
            <AlertTriangle className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className={styles.title}>{title}</DialogTitle>
            <div className={styles.hint}>此操作不可恢复</div>
          </div>
          <DialogClose asChild>
            <button type="button" className={styles.closeBtn} aria-label="关闭" disabled={confirming}>
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className={styles.body}>{message}</div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onCancel}
            disabled={confirming}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "删除中..." : confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
