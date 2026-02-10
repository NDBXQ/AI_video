"use client"

import { useSyncExternalStore } from "react"
import { readCollapsedState } from "./collapseStorage"

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = () => callback()
  window.addEventListener("storage", handler)
  window.addEventListener("video-asset-sidebar:collapsed", handler)
  return () => {
    window.removeEventListener("storage", handler)
    window.removeEventListener("video-asset-sidebar:collapsed", handler)
  }
}

export function useCollapsedPreference(key: string, defaultValue: boolean): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readCollapsedState(key, defaultValue),
    () => defaultValue
  )
}

