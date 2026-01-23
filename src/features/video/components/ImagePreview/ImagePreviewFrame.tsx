import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import styles from "./ImagePreviewFrame.module.css"
import {
  type NormalizedRect,
  type ResizeHandle,
  applyResize,
  normalizeRect,
  clamp01,
  clamp,
  calculateContainMetrics,
  rectToStyle,
} from "../../utils/imageEditorUtils"

type Props = {
  src: string
  alt: string
  isEditing: boolean
  rect: NormalizedRect | null
  onRectChange: (rect: NormalizedRect | null) => void
  onEditStart: () => void
  onEditEnd: () => void
  onClearSelection: () => void
  loading?: boolean
  imageSize: { width: number; height: number } | null
  setImageSize: (size: { width: number; height: number } | null) => void
}

export function ImagePreviewFrame({
  src,
  alt,
  isEditing,
  rect,
  onRectChange,
  onEditStart,
  onEditEnd,
  onClearSelection,
  loading,
  imageSize,
  setImageSize,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameRect, setFrameRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const selectionDragRef = useRef<{
    mode: "move" | "resize" | "create"
    startClientX: number
    startClientY: number
    startRect: NormalizedRect
    startX: number
    startY: number
    handle?: ResizeHandle
    dragging?: boolean
  } | null>(null)

  useEffect(() => {
    if (!src) return
    const img = new window.Image()
    let cancelled = false
    img.onload = () => {
      if (cancelled) return
      const width = Number(img.naturalWidth) || 0
      const height = Number(img.naturalHeight) || 0
      if (width > 0 && height > 0) setImageSize({ width, height })
    }
    img.onerror = () => {
      if (cancelled) return
      setImageSize(null)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, setImageSize])

  useEffect(() => {
    const updateRect = () => {
      if (frameRef.current) {
        const rect = frameRef.current.getBoundingClientRect()
        setFrameRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateRect()
    const ro = new ResizeObserver(updateRect)
    if (frameRef.current) ro.observe(frameRef.current)
    window.addEventListener("scroll", updateRect, { capture: true, passive: true })
    window.addEventListener("resize", updateRect)

    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", updateRect, { capture: true } as any)
      window.removeEventListener("resize", updateRect)
    }
  }, [imageSize])

  const containMetrics = useMemo(() => calculateContainMetrics(imageSize, frameRect), [imageSize, frameRect])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditing || !containMetrics || !frameRef.current) return
    e.stopPropagation()
    const frame = frameRef.current
    const rect = frame.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = clamp(x, containMetrics.ox, containMetrics.ox + containMetrics.dw)
    const cy = clamp(y, containMetrics.oy, containMetrics.oy + containMetrics.dh)
    const nx = clamp01((cx - containMetrics.ox) / containMetrics.dw)
    const ny = clamp01((cy - containMetrics.oy) / containMetrics.dh)

    selectionDragRef.current = {
      mode: "create",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: { x: nx, y: ny, w: 0, h: 0 },
      startX: cx,
      startY: cy,
      dragging: true,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = selectionDragRef.current
    if (!isEditing || !drag?.dragging) return
    if (!containMetrics || !frameRef.current) return
    const frame = frameRef.current
    const r = frame.getBoundingClientRect()

    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const cx = clamp(x, containMetrics.ox, containMetrics.ox + containMetrics.dw)
    const cy = clamp(y, containMetrics.oy, containMetrics.oy + containMetrics.dh)
    const minX = Math.min(drag.startX, cx)
    const minY = Math.min(drag.startY, cy)
    const maxX = Math.max(drag.startX, cx)
    const maxY = Math.max(drag.startY, cy)
    const nx = clamp01((minX - containMetrics.ox) / containMetrics.dw)
    const ny = clamp01((minY - containMetrics.oy) / containMetrics.dh)
    const nw = clamp01((maxX - containMetrics.ox) / containMetrics.dw) - nx
    const nh = clamp01((maxY - containMetrics.oy) / containMetrics.dh) - ny
    onRectChange({ x: nx, y: ny, w: Math.max(0, nw), h: Math.max(0, nh) })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = selectionDragRef.current
    if (!drag?.dragging) return
    selectionDragRef.current = { ...drag, dragging: false }
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    
    // Auto-confirm logic is handled by parent if needed, or we just stop dragging here.
    // In original code, it called setConfirmedRect and setIsEditing(false) here.
    // I will let parent handle the "finish creation" logic if possible, but here we just stop dragging.
    // Actually, the original code did side effects here.
    // "setDraftRect((cur) => { ... setConfirmedRect(normalizeRect(cur)); setIsEditing(false); return null })"
    
    // To keep it simple and controlled, I will emit the final rect via onRectChange
    // and let the parent decide when to switch mode?
    // But wait, `handlePointerUp` in `create` mode implies we finished drawing the box.
    // I should probably expose `onCreationEnd`?
    
    if (drag.mode === "create") {
         onEditEnd() // Signal that creation is done
    }
  }
  
  // Wait, if I use `onEditEnd` here, it might just toggle `isEditing` to false.
  // The parent needs to know we finished creating a rect so it can move draft -> confirmed.
  // I think I should pass `onCreateComplete` prop.
  
  const startMove = (e: React.PointerEvent) => {
    if (!rect || loading || !containMetrics) return
    e.stopPropagation()
    selectionDragRef.current = {
      mode: "move",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: rect,
      startX: 0,
      startY: 0,
      dragging: true,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const startResize = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    if (!rect || loading || !containMetrics) return
    e.stopPropagation()
    selectionDragRef.current = {
      mode: "resize",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: rect,
      startX: 0,
      startY: 0,
      handle,
      dragging: true,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onSelectionPointerMove = (e: React.PointerEvent) => {
    const drag = selectionDragRef.current
    if (!drag?.dragging || !containMetrics) return
    e.stopPropagation()
    const dxPx = e.clientX - drag.startClientX
    const dyPx = e.clientY - drag.startClientY
    
    const dx = containMetrics.dw > 0 ? dxPx / containMetrics.dw : 0
    const dy = containMetrics.dh > 0 ? dyPx / containMetrics.dh : 0

    if (drag.mode === "move") {
      const x = clamp01(drag.startRect.x + dx)
      const y = clamp01(drag.startRect.y + dy)
      onRectChange(normalizeRect({ ...drag.startRect, x, y }))
      return
    }
    if (drag.mode === "resize" && drag.handle) {
      onRectChange(normalizeRect(applyResize(drag.handle, drag.startRect, dx, dy)))
    }
  }

  const onSelectionPointerUp = (e: React.PointerEvent) => {
    selectionDragRef.current = null
    e.stopPropagation()
  }

  const overlayStyle = rectToStyle(rect, containMetrics)
  const canEdit = Boolean(src && imageSize)

  return (
    <div className={styles.container}>
      <div
        ref={frameRef}
        className={styles.frame}
        style={{ aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : undefined }}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized
            sizes="(max-width: 1023px) 100vw, 980px"
            style={{ objectFit: "contain" }}
          />
        ) : null}
        
        <button
          type="button"
          className={styles.editButton}
          disabled={!canEdit || loading}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!canEdit) return
            if (isEditing) {
                onEditEnd()
            } else {
                onEditStart()
            }
          }}
        >
          {isEditing ? "退出编辑" : "编辑"}
        </button>

        {isEditing ? (
          <div
            className={styles.editOverlay}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            role="presentation"
          />
        ) : null}

        {overlayStyle ? (
          <div
            className={styles.selectionRect}
            style={{
              left: overlayStyle.left,
              top: overlayStyle.top,
              width: overlayStyle.width,
              height: overlayStyle.height,
            }}
            onPointerDown={startMove}
            onPointerMove={onSelectionPointerMove}
            onPointerUp={onSelectionPointerUp}
            onPointerCancel={onSelectionPointerUp}
          >
            <>
                <div className={`${styles.selectionHandle} ${styles.handleNw}`} onPointerDown={startResize("nw")} />
                <div className={`${styles.selectionHandle} ${styles.handleN}`} onPointerDown={startResize("n")} />
                <div className={`${styles.selectionHandle} ${styles.handleNe}`} onPointerDown={startResize("ne")} />
                <div className={`${styles.selectionHandle} ${styles.handleE}`} onPointerDown={startResize("e")} />
                <div className={`${styles.selectionHandle} ${styles.handleSe}`} onPointerDown={startResize("se")} />
                <div className={`${styles.selectionHandle} ${styles.handleS}`} onPointerDown={startResize("s")} />
                <div className={`${styles.selectionHandle} ${styles.handleSw}`} onPointerDown={startResize("sw")} />
                <div className={`${styles.selectionHandle} ${styles.handleW}`} onPointerDown={startResize("w")} />
            </>
          </div>
        ) : null}

        {!isEditing && rect ? (
          <div className={styles.editControls}>
            <button
              type="button"
              className={styles.editCtrlBtn}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClearSelection()
              }}
            >
              清除/重选
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
