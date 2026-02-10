"use client"

import { useEffect } from "react"
import type { ChatMessage } from "@/features/tvc/types"
import { extractClarificationMarkdown } from "@/features/tvc/workspace/creation/extractClarificationMarkdown"
import { collectUserProvidedImages } from "@/features/tvc/workspace/creation/collectUserProvidedImages"
import { applyAssetsToAssetUrlByKey } from "@/features/tvc/workspace/creation/applyAssetsToAssetUrlByKey"
import { parseCreationChatMessages } from "@/features/tvc/workspace/creation/parseCreationChatMessages"

export function useTvcCreationHydration(params: {
  projectId: string | null
  clarificationText: string
  hydrateClarification: (markdown: string) => void
  notifyAssetDrivenSteps: (items: unknown[]) => void
  setUserProvidedImages: (updater: (prev: Array<{ ordinal: number; url: string; thumbnailUrl?: string }>) => Array<{ ordinal: number; url: string; thumbnailUrl?: string }>) => void
  setAssetUrlByKey: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  setInitialChatMessages: (messages: ChatMessage[] | null) => void
}): void {
  const { projectId, clarificationText, hydrateClarification, notifyAssetDrivenSteps, setUserProvidedImages, setAssetUrlByKey, setInitialChatMessages } = params

  useEffect(() => {
    if (!projectId) return
    void (async () => {
      const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/creation`, { method: "GET", cache: "no-store" }).catch(() => null)
      if (!res) return
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.ok) return

      const messages = Array.isArray(json?.data?.messages) ? (json.data.messages as any[]) : []
      const assets = Array.isArray(json?.data?.assets) ? (json.data.assets as any[]) : []

      if (assets.length > 0) {
        const clarificationMarkdown = extractClarificationMarkdown(assets)
        if (clarificationMarkdown && clarificationText.trim() !== clarificationMarkdown.trim()) {
          hydrateClarification(clarificationMarkdown)
        }

        notifyAssetDrivenSteps(assets)
        setUserProvidedImages(() => collectUserProvidedImages(assets))
        setAssetUrlByKey((prev) => applyAssetsToAssetUrlByKey(prev, assets))
      }

      if (messages.length > 0) {
        const chat = parseCreationChatMessages(messages)
        if (chat.length > 0) setInitialChatMessages(chat)
      }
    })()
  }, [clarificationText, hydrateClarification, notifyAssetDrivenSteps, projectId, setAssetUrlByKey, setInitialChatMessages, setUserProvidedImages])
}
