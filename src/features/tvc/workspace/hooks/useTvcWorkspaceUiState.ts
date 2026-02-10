"use client"

import { useEffect, useState } from "react"
import type { TvcPhaseId, TvcPreviewTab } from "@/features/tvc/types"

export function useTvcWorkspaceUiState(): {
  isCompact: boolean
  activePhase: TvcPhaseId
  setActivePhase: (id: TvcPhaseId) => void
  activeTab: TvcPreviewTab
  setActiveTab: (tab: TvcPreviewTab) => void
  chatFocusToken: number
  setChatFocusToken: (updater: (v: number) => number) => void
  chatDrawerOpen: boolean
  setChatDrawerOpen: (open: boolean) => void
  activeDock: "edit" | "board"
  setActiveDock: (dock: "edit" | "board") => void
} {
  const [isCompact, setIsCompact] = useState(false)
  const [activePhase, setActivePhase] = useState<TvcPhaseId>("clarification")
  const [activeTab, setActiveTab] = useState<TvcPreviewTab>("shotlist")
  const [chatFocusToken, setChatFocusToken] = useState(0)
  const [activeDock, setActiveDock] = useState<"edit" | "board">("board")
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)

  useEffect(() => {
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => {
            void Promise.resolve().then(cb)
          }
    const query = window.matchMedia("(max-width: 1023px)")
    schedule(() => setIsCompact(query.matches))
    const onChange = (e: MediaQueryListEvent) => {
      setIsCompact(e.matches)
      if (!e.matches) setChatDrawerOpen(false)
    }
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return { isCompact, activePhase, setActivePhase, activeTab, setActiveTab, chatFocusToken, setChatFocusToken, chatDrawerOpen, setChatDrawerOpen, activeDock, setActiveDock }
}
