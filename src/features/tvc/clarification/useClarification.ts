"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ClarificationEvent, ClarificationUiState } from "./types"

export function useClarification() {
  const fullRef = useRef("")
  const flushTimerRef = useRef<number | null>(null)
  const lastFlushAtRef = useRef(0)
  const [clarification, setClarification] = useState<ClarificationUiState>(null)

  const reset = useCallback(() => {
    fullRef.current = ""
    setClarification(null)
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const hydrate = useCallback((markdown: string) => {
    const text = String(markdown ?? "")
    if (!text.trim()) return
    fullRef.current = text
    setClarification({ text, done: true })
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const onClarification = useCallback((e: ClarificationEvent) => {
    if (e.phase === "done") {
      const markdown = String(e.markdown ?? "")
      fullRef.current = markdown
      setClarification({ text: markdown, done: true })
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      return
    }

    const piece = String(e.markdown ?? "")
    if (!piece) return
    fullRef.current += piece
    const now = performance.now()
    if (now - lastFlushAtRef.current > 120) {
      lastFlushAtRef.current = now
      setClarification({ text: fullRef.current, done: false })
      return
    }
    if (flushTimerRef.current != null) return
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      lastFlushAtRef.current = performance.now()
      setClarification((prev) => ({ text: fullRef.current, done: prev?.done ?? false }))
    }, 120)
  }, [])

  useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [])

  return { clarification, onClarification, reset, hydrate }
}
