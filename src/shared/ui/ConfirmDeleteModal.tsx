"use client"

import { useMemo, type ReactElement } from "react"
import { ConfirmModal } from "./ConfirmModal"

export function ConfirmDeleteModal(props: {
  open: boolean
  title?: string
  itemName: string
  message?: string
  confirming?: boolean
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}): ReactElement | null {
  const { open, title, itemName, message, confirming, confirmText, cancelText, onConfirm, onCancel } = props

  const resolvedTitle = useMemo(() => (title?.trim() ? title.trim() : "删除"), [title])
  const resolvedMessage = useMemo(() => {
    const raw = (message ?? "").trim()
    if (raw) return raw
    const name = itemName.trim()
    return `确定删除「${name}」吗？\n此操作不可恢复。`
  }, [itemName, message])

  return (
    <ConfirmModal
      open={open}
      title={resolvedTitle}
      message={resolvedMessage}
      confirmText={confirmText}
      cancelText={cancelText}
      confirming={confirming}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

