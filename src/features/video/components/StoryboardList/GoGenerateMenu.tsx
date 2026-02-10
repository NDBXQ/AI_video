import { useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import styles from "./GoGenerateMenu.module.css"

export type GoGenerateTarget = "image" | "video"

type GoGenerateMenuProps = {
  open: boolean
  menuId: string
  anchorRect: DOMRect | null
  onClose: () => void
  onSelect: (target: GoGenerateTarget) => void
}

export function GoGenerateMenu({ open, menuId, anchorRect, onClose, onSelect }: GoGenerateMenuProps): ReactElement | null {
  const canPortal = typeof document !== "undefined"
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const firstItemRef = useRef<HTMLButtonElement | null>(null)

  const safeAnchor = useMemo(() => {
    if (!open || !anchorRect) return null
    return anchorRect
  }, [anchorRect, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!safeAnchor) return

    const updatePos = () => {
      const menuEl = menuRef.current
      if (!menuEl) return
      const menuBox = menuEl.getBoundingClientRect()

      const margin = 12
      const preferTop = safeAnchor.bottom + 8
      const preferLeft = safeAnchor.left

      let left = Math.max(margin, Math.min(preferLeft, window.innerWidth - menuBox.width - margin))
      let top = preferTop
      if (top + menuBox.height > window.innerHeight - margin) {
        top = Math.max(margin, safeAnchor.top - menuBox.height - 8)
      }
      setPos({ top, left })
    }

    updatePos()
    window.addEventListener("resize", updatePos)
    window.addEventListener("scroll", updatePos, true)
    return () => {
      window.removeEventListener("resize", updatePos)
      window.removeEventListener("scroll", updatePos, true)
    }
  }, [safeAnchor])

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
  }, [open])

  if (!safeAnchor) return null

  const content = (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={() => onClose()}
    >
      <div
        id={menuId}
        className={styles.menu}
        role="menu"
        aria-label="去生成"
        ref={menuRef}
        style={pos ? { top: pos.top, left: pos.left } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={firstItemRef}
          type="button"
          className={styles.menuItem}
          role="menuitem"
          onClick={() => {
            onSelect("image")
            onClose()
          }}
        >
          生成图片
        </button>
        <button
          type="button"
          className={styles.menuItem}
          role="menuitem"
          onClick={() => {
            onSelect("video")
            onClose()
          }}
        >
          生成视频
        </button>
      </div>
    </div>
  )

  return canPortal ? createPortal(content, document.body) : content
}

