"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import styles from "./ListboxSelect.module.css"

type Option = { value: string; label: string; disabled?: boolean }

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function computePopoverRect(params: { anchor: DOMRect; maxHeight: number }): { top: number; left: number; width: number; maxHeight: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 6
  const margin = 8
  const width = Math.max(220, Math.round(params.anchor.width))
  const left = clamp(Math.round(params.anchor.left), margin, Math.max(margin, vw - margin - width))

  const belowTop = Math.round(params.anchor.bottom + gap)
  const aboveTop = Math.round(params.anchor.top - gap)
  const spaceBelow = vh - margin - belowTop
  const spaceAbove = aboveTop - margin
  const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove

  if (preferBelow) {
    const maxH = clamp(params.maxHeight, 160, Math.max(160, spaceBelow))
    return { top: belowTop, left, width, maxHeight: maxH }
  }

  const maxH = clamp(params.maxHeight, 160, Math.max(160, spaceAbove))
  const top = Math.round(params.anchor.top - gap - maxH)
  return { top: clamp(top, margin, vh - margin - maxH), left, width, maxHeight: maxH }
}

export function ListboxSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  className,
  portalZIndex
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
  portalZIndex?: number
}): ReactElement {
  const listboxId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value])
  const selectedLabel = useMemo(() => options.find((o) => o.value === value)?.label ?? "", [options, value])

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const openWithActive = useCallback(
    (nextActive?: number) => {
      if (disabled) return
      const idx = typeof nextActive === "number" ? clamp(nextActive, 0, Math.max(0, options.length - 1)) : selectedIndex >= 0 ? selectedIndex : 0
      setActiveIndex(idx)
      setOpen(true)
    },
    [disabled, options.length, selectedIndex]
  )

  const updateRect = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const anchor = el.getBoundingClientRect()
    setRect(computePopoverRect({ anchor, maxHeight: 360 }))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateRect()
  }, [open, updateRect])

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null
      if (!t) return
      const trigger = triggerRef.current
      const pop = popoverRef.current
      if (trigger?.contains(t)) return
      if (pop?.contains(t)) return
      close()
    }
    const onWinResize = () => updateRect()
    const onWinScroll = () => updateRect()

    document.addEventListener("mousedown", onDocPointerDown, true)
    document.addEventListener("touchstart", onDocPointerDown, true)
    window.addEventListener("resize", onWinResize)
    window.addEventListener("scroll", onWinScroll, true)

    const raf = requestAnimationFrame(() => {
      listRef.current?.focus()
      const activeEl = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null
      activeEl?.scrollIntoView({ block: "nearest" })
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("mousedown", onDocPointerDown, true)
      document.removeEventListener("touchstart", onDocPointerDown, true)
      window.removeEventListener("resize", onWinResize)
      window.removeEventListener("scroll", onWinScroll, true)
    }
  }, [activeIndex, close, open, updateRect])

  const selectAt = useCallback(
    (idx: number) => {
      const opt = options[idx]
      if (!opt || opt.disabled) return
      onChange(opt.value)
      close()
    },
    [close, onChange, options]
  )

  const moveActive = useCallback(
    (delta: number) => {
      if (options.length === 0) return
      let next = activeIndex
      for (let i = 0; i < options.length; i += 1) {
        next = clamp(next + delta, 0, options.length - 1)
        if (!options[next]?.disabled) break
        if (next === 0 || next === options.length - 1) break
      }
      setActiveIndex(next)
      requestAnimationFrame(() => {
        const activeEl = listRef.current?.querySelector(`[data-idx="${next}"]`) as HTMLElement | null
        activeEl?.scrollIntoView({ block: "nearest" })
      })
    },
    [activeIndex, options]
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${className ?? ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={Boolean(disabled)}
        onClick={() => {
          if (open) close()
          else openWithActive()
        }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            openWithActive(selectedIndex >= 0 ? selectedIndex + 1 : 0)
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            openWithActive(selectedIndex >= 0 ? selectedIndex - 1 : 0)
            return
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openWithActive()
          }
        }}
      >
        <span className={styles.triggerText}>{selectedLabel || "请选择"}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.8 9.3 12 14.5l5.2-5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && rect
        ? createPortal(
            <>
              <div className={styles.backdrop} aria-hidden="true" style={portalZIndex ? { zIndex: portalZIndex } : undefined} />
              <div
                ref={popoverRef}
                className={styles.popover}
                style={
                  portalZIndex
                    ? { top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight, zIndex: portalZIndex + 1 }
                    : { top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }
                }
              >
                <div
                  id={listboxId}
                  ref={listRef}
                  className={styles.list}
                  role="listbox"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault()
                      close()
                      return
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      moveActive(1)
                      return
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault()
                      moveActive(-1)
                      return
                    }
                    if (e.key === "Home") {
                      e.preventDefault()
                      setActiveIndex(0)
                      return
                    }
                    if (e.key === "End") {
                      e.preventDefault()
                      setActiveIndex(options.length - 1)
                      return
                    }
                    if (e.key === "Enter") {
                      e.preventDefault()
                      selectAt(activeIndex)
                      return
                    }
                  }}
                >
                  {options.map((opt, idx) => {
                    const selected = opt.value === value
                    const active = idx === activeIndex
                    return (
                      <div
                        key={opt.value}
                        role="option"
                        aria-selected={selected}
                        data-idx={idx}
                        className={`${styles.option} ${active ? styles.optionActive : ""} ${selected ? styles.optionSelected : ""} ${opt.disabled ? styles.optionDisabled : ""}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectAt(idx)
                        }}
                      >
                        <span className={styles.triggerText}>{opt.label}</span>
                        {selected ? (
                          <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  )
}
