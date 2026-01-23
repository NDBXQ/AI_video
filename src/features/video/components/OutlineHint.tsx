"use client"

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import styles from "./OutlineHint.module.css"

type OutlineHintProps = Readonly<{
  text: string
  ariaLabel: string
}>

export function OutlineHint({ text, ariaLabel }: OutlineHintProps): ReactElement | null {
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  const hasText = useMemo(() => Boolean(text && text.trim()), [text])
  const canPortal = typeof document !== "undefined"

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const rect = trigger.getBoundingClientRect()
    const tipRect = tooltip.getBoundingClientRect()

    const gap = 10
    const margin = 12
    const preferredLeft = rect.left
    const maxLeft = Math.max(margin, window.innerWidth - tipRect.width - margin)
    const left = Math.min(Math.max(preferredLeft, margin), maxLeft)

    const belowTop = rect.bottom + gap
    const aboveTop = rect.top - gap - tipRect.height
    const fitsBelow = belowTop + tipRect.height <= window.innerHeight - margin
    const top = fitsBelow ? belowTop : Math.max(margin, aboveTop)

    setPos({ left, top })
  }, [])

  const show = useCallback(() => {
    if (!hasText) return
    setOpen(true)
  }, [hasText])

  const hide = useCallback(() => setOpen(false), [])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!hasText) return
      setOpen((v) => !v)
    },
    [hasText]
  )

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useLayoutEffect(() => {
    if (!open) return
    const onResize = () => updatePosition()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [open, updatePosition])

  if (!hasText) return null

  return (
    <>
      <span
        ref={triggerRef}
        className={styles.hint}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={onClick}
      >
        ?
      </span>
      {canPortal && open
        ? createPortal(
            <div ref={tooltipRef} className={styles.tooltip} style={{ left: pos.left, top: pos.top }}>
              {text}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
