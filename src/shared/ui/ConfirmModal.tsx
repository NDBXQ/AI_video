"use client"

import type { ReactElement } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/shared/ui/shadcn/dialog"
import { Button } from "@/shared/ui/shadcn/button"

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
      <DialogContent className="border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-[var(--theme-shadow-strong)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--theme-text-strong)]">{title}</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-line text-sm text-[var(--theme-text-muted)]">
          {message}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "删除中..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
