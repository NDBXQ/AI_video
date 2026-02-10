"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactElement, RefObject } from "react"
import styles from "../ScriptWorkspacePage.module.css"

type WorkspaceResizeHandleProps = {
  containerRef: RefObject<HTMLElement | null>
}

const STORAGE_KEY = "script_workspace_sidebar_width_px"
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 420

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WIDTH
  if (value < MIN_WIDTH) return MIN_WIDTH
  if (value > MAX_WIDTH) return MAX_WIDTH
  return Math.round(value)
}

export function WorkspaceResizeHandle({ containerRef }: WorkspaceResizeHandleProps): ReactElement {
  const [active, setActive] = useState(false)
  const [widthPx, setWidthPx] = useState(DEFAULT_WIDTH)
  const lastClientXRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const prevUserSelectRef = useRef<string | null>(null)

  const applyWidth = useCallback(
    (widthPx: number) => {
      const clamped = clampWidth(widthPx)
      setWidthPx(clamped)
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped))
      } catch {}
    },
    []
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = Number(raw)
      if (!Number.isFinite(stored)) return
      const next = clampWidth(stored)
      if (next === DEFAULT_WIDTH) return
      const rafId = window.requestAnimationFrame(() => applyWidth(next))
      return () => window.cancelAnimationFrame(rafId)
    } catch {}
  }, [applyWidth])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.style.setProperty("--workspace-sidebar-width", `${widthPx}px`)
  }, [containerRef, widthPx])

  const scheduleFromClientX = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const widthPx = rect.right - lastClientXRef.current
      applyWidth(widthPx)
    })
  }, [applyWidth, containerRef])

  useEffect(() => {
    if (!active) return

    const onMove = (e: PointerEvent) => {
      lastClientXRef.current = e.clientX
      scheduleFromClientX()
    }

    const onUp = () => {
      setActive(false)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [active, scheduleFromClientX])

  useEffect(() => {
    if (active) {
      prevUserSelectRef.current = document.body.style.userSelect
      document.body.style.userSelect = "none"
      return
    }
    if (prevUserSelectRef.current != null) {
      document.body.style.userSelect = prevUserSelectRef.current
      prevUserSelectRef.current = null
    }
  }, [active])

  return (
    <div
      className={active ? `${styles.resizeHandle} ${styles.resizeHandleActive}` : styles.resizeHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label="调整对话栏宽度"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={widthPx}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        lastClientXRef.current = e.clientX
        setActive(true)
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        scheduleFromClientX()
      }}
      onDoubleClick={() => applyWidth(DEFAULT_WIDTH)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault()
          const delta = e.shiftKey ? 60 : 20
          const next = e.key === "ArrowLeft" ? widthPx + delta : widthPx - delta
          applyWidth(next)
          return
        }
        if (e.key === "Home") {
          e.preventDefault()
          applyWidth(MIN_WIDTH)
          return
        }
        if (e.key === "End") {
          e.preventDefault()
          applyWidth(MAX_WIDTH)
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          applyWidth(DEFAULT_WIDTH)
        }
      }}
    />
  )
}
