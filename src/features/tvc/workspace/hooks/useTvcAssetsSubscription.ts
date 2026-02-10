"use client"

import { useEffect } from "react"
import { buildAssetMetaKey } from "@/features/tvc/workspace/hooks/assetMetaKey"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import type { TvcPhaseId } from "@/features/tvc/types"

export function useTvcAssetsSubscription(params: {
  projectId: string | null
  clarificationText: string
  hydrateClarification: (markdown: string) => void
  notifyAssetDrivenSteps: (items: unknown[]) => void
  setAgentPhaseById: React.Dispatch<React.SetStateAction<Partial<Record<TvcPhaseId, TvcAgentStep>>>>
  setUserProvidedImages: React.Dispatch<React.SetStateAction<Array<{ ordinal: number; url: string; thumbnailUrl?: string }>>>
  setAssetUrlByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>
}): void {
  const { projectId, clarificationText, hydrateClarification, notifyAssetDrivenSteps, setAgentPhaseById, setUserProvidedImages, setAssetUrlByKey } = params

  useEffect(() => {
    if (!projectId) return
    let disposed = false
    let cursor = ""
    let inFlight = false
    let pending = false
    let debounceTimer: number | null = null
    let reconnectTimer: number | null = null
    let reconnectAttempt = 0
    let es: EventSource | null = null

    const applyItems = (items: any[]) => {
      if (!Array.isArray(items) || items.length === 0) return
      const clarificationMarkdown = (() => {
        for (const a of items) {
          const kind = String(a?.kind ?? "").trim()
          if (kind !== "clarification") continue
          const meta = (a?.meta ?? {}) as any
          const markdown = String(meta?.markdown ?? "").trim()
          if (markdown) return markdown
        }
        return ""
      })()
      if (clarificationMarkdown && clarificationText.trim() !== clarificationMarkdown.trim()) {
        hydrateClarification(clarificationMarkdown)
      }

      const scriptMarkdown = (() => {
        for (const a of items) {
          const kind = String(a?.kind ?? "").trim()
          if (kind !== "script") continue
          const meta = (a?.meta ?? {}) as any
          const markdown = String(meta?.markdown ?? "").trim()
          if (markdown) return markdown
        }
        return ""
      })()
      if (scriptMarkdown) {
        setAgentPhaseById((prev) => {
          const existing = prev.script
          const existingMarkdown = String(existing?.content?.scriptMarkdown ?? "").trim()
          if (existingMarkdown === scriptMarkdown.trim()) return prev
          const existingStream = (existing?.content?.stream ?? {}) as any
          const next: TvcAgentStep = {
            id: "script",
            title: existing?.title?.trim() ? existing.title : "剧情",
            content: { ...(existing?.content ?? {}), scriptMarkdown, stream: { ...existingStream, scriptMarkdown: false } }
          }
          return { ...prev, script: next }
        })
      }

      const storyboards = (() => {
        for (const a of items) {
          const kind = String(a?.kind ?? "").trim()
          if (kind !== "storyboards") continue
          const meta = (a?.meta ?? {}) as any
          const list = Array.isArray(meta?.storyboards) ? (meta.storyboards as any[]) : []
          if (list.length === 0) continue
          return list
            .map((row) => {
              const rec = row as Record<string, unknown>
              const out: Record<string, string> = {}
              for (const [k, v] of Object.entries(rec)) {
                const kk = String(k ?? "").trim()
                const vv = String(v ?? "").trim()
                if (kk && vv) out[kk] = vv
              }
              return out
            })
            .filter((r) => Object.keys(r).length > 0)
        }
        return []
      })()
      if (storyboards.length > 0) {
        setAgentPhaseById((prev) => {
          const existing = prev.storyboard
          const existingLen = Array.isArray(existing?.content?.storyboards) ? (existing!.content.storyboards!.length ?? 0) : 0
          if (existingLen === storyboards.length) return prev
          const existingStream = (existing?.content?.stream ?? {}) as any
          const next: TvcAgentStep = {
            id: "storyboard",
            title: existing?.title?.trim() ? existing.title : "分镜",
            content: { ...(existing?.content ?? {}), storyboards, stream: { ...existingStream, storyboards: false } }
          }
          return { ...prev, storyboard: next }
        })
      }

      setUserProvidedImages((prev) => {
        const byOrdinal = new Map<number, { ordinal: number; url: string; thumbnailUrl?: string }>()
        for (const it of prev) byOrdinal.set(it.ordinal, { ...it })
        for (const a of items) {
          const kind = String(a?.kind ?? "").trim()
          if (kind !== "user_image") continue
          const ordinal = Number.parseInt(String(a?.ordinal ?? a?.index ?? "").replace(/[^\d]/g, ""), 10)
          if (!Number.isFinite(ordinal) || ordinal <= 0) continue
          const url = String(a?.url ?? "").trim()
          const thumbnailUrl = String(a?.thumbnailUrl ?? "").trim()
          if (!url && !thumbnailUrl) continue
          byOrdinal.set(ordinal, { ordinal, url, ...(thumbnailUrl ? { thumbnailUrl } : {}) })
        }
        return Array.from(byOrdinal.values()).sort((x, y) => x.ordinal - y.ordinal)
      })

      setAssetUrlByKey((prev) => {
        const next: Record<string, string> = { ...prev }
        for (const a of items) {
          const kind = String(a?.kind ?? "").trim()
          if (kind === "script" || kind === "storyboards") continue
          const ordinal = Number.parseInt(String(a?.ordinal ?? a?.index ?? "").replace(/[^\d]/g, ""), 10)
          const url = String(a?.url ?? "").trim()
          const thumbnailUrl = String(a?.thumbnailUrl ?? "").trim()
          if (!kind || !Number.isFinite(ordinal) || ordinal <= 0) continue
          const baseKey = `${kind}:${ordinal}`
          const nextBase = (thumbnailUrl || url).trim()
          if (nextBase && next[baseKey] !== nextBase) next[baseKey] = nextBase
          if (url && next[`${baseKey}:orig`] !== url) next[`${baseKey}:orig`] = url
          const meta = (a?.meta ?? {}) as any
          if (kind === "reference_image") {
            const metaKey = buildAssetMetaKey(kind, [meta?.category ?? "", meta?.name ?? ""])
            if (nextBase && next[metaKey] !== nextBase) next[metaKey] = nextBase
            if (url && next[`${metaKey}:orig`] !== url) next[`${metaKey}:orig`] = url
          }
          if (kind === "first_frame") {
            const metaKey = buildAssetMetaKey(kind, [meta?.description ?? "", meta?.referenceImages ?? ""])
            if (nextBase && next[metaKey] !== nextBase) next[metaKey] = nextBase
            if (url && next[`${metaKey}:orig`] !== url) next[`${metaKey}:orig`] = url
          }
        }
        return next
      })
    }

    const fetchDelta = async () => {
      if (disposed) return
      if (inFlight) {
        pending = true
        return
      }
      inFlight = true
      pending = false
      try {
        const base = `/api/tvc/projects/${encodeURIComponent(projectId)}/assets`
        const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base
        const res = await fetch(url, { method: "GET", cache: "no-store" }).catch(() => null)
        if (!res) return
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || !json?.ok) return
        const items = Array.isArray(json?.data?.items) ? (json.data.items as any[]) : []
        const nextCursor = String(json?.data?.cursor ?? "").trim()
        if (nextCursor) cursor = nextCursor
        if (items.length > 0) notifyAssetDrivenSteps(items)
        applyItems(items)
      } finally {
        inFlight = false
        if (pending) scheduleFetch(0)
      }
    }

    const scheduleFetch = (delayMs: number) => {
      if (disposed) return
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void fetchDelta()
      }, Math.max(0, delayMs))
    }

    const closeEs = () => {
      if (!es) return
      try {
        es.close()
      } catch {
      }
      es = null
    }

    const scheduleReconnect = () => {
      if (disposed) return
      closeEs()
      if (reconnectTimer != null) return
      reconnectAttempt += 1
      const delay = Math.min(10_000, 500 + reconnectAttempt * 500)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        openEs()
      }, delay)
    }

    const openEs = () => {
      if (disposed) return
      closeEs()
      const base = `/api/tvc/projects/${encodeURIComponent(projectId)}/assets/events`
      const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base
      es = new EventSource(url)
      const onAsset = () => {
        scheduleFetch(120)
      }
      es.addEventListener("asset", onAsset)
      es.onopen = () => {
        reconnectAttempt = 0
      }
      es.onerror = () => {
        try {
          es?.removeEventListener("asset", onAsset)
        } catch {
        }
        scheduleReconnect()
      }
    }

    const init = async () => {
      await fetchDelta()
      if (disposed) return
      openEs()
    }
    void init()

    return () => {
      disposed = true
      if (debounceTimer != null) {
        window.clearTimeout(debounceTimer)
        debounceTimer = null
      }
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      try {
        closeEs()
      } catch {
      }
    }
  }, [clarificationText, hydrateClarification, notifyAssetDrivenSteps, projectId, setAgentPhaseById, setAssetUrlByKey, setUserProvidedImages])
}
