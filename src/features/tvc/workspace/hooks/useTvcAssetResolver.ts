"use client"

import { useEffect, useState } from "react"
import type { TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import { extractAssetIndex } from "./extractAssetIndex"

export function useTvcAssetResolver(params: { projectId: string; agentStepByCanvasId: Partial<Record<TvcPhaseId, TvcAgentStep>> }): {
  assetUrlByKey: Record<string, string>
  setAssetUrlByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>
} {
  const [assetUrlByKey, setAssetUrlByKey] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!params.projectId) return
    const needed: Array<{ kind: "reference_image" | "first_frame" | "video_clip"; index: number }> = []

    const pushItem = (kind: "reference_image" | "first_frame" | "video_clip", item: unknown) => {
      const index = extractAssetIndex(item)
      if (!index) return
      needed.push({ kind, index })
    }

    const reference = params.agentStepByCanvasId.reference_image
    for (const img of (reference?.content?.images ?? []) as any[]) {
      pushItem("reference_image", img)
    }
    const firstFrames = params.agentStepByCanvasId.first_frame
    for (const img of (firstFrames?.content?.images ?? []) as any[]) {
      pushItem("first_frame", img)
    }
    const videos = params.agentStepByCanvasId.video_clip
    for (const clip of (videos?.content?.videoClips ?? []) as any[]) {
      pushItem("video_clip", clip)
    }

    const unique = new Map<string, { kind: "reference_image" | "first_frame" | "video_clip"; index: number }>()
    for (const it of needed) unique.set(`${it.kind}:${it.index}`, it)

    const missing = Array.from(unique.values()).filter((it) => !assetUrlByKey[`${it.kind}:${it.index}`])
    if (missing.length === 0) return

    let cancelled = false
    const run = async () => {
      await Promise.all(
        missing.map(async (it) => {
          const res = await fetch(
            `/api/tvc/projects/${encodeURIComponent(params.projectId)}/assets/resolve?kind=${encodeURIComponent(it.kind)}&index=${encodeURIComponent(
              String(it.index)
            )}`,
            { method: "GET", cache: "no-store" }
          ).catch(() => null)
          const json = (await res?.json().catch(() => null)) as any
          const url = String(json?.data?.url ?? "").trim()
          const thumbnailUrl = String(json?.data?.thumbnailUrl ?? "").trim()
          if (!url && !thumbnailUrl) return
          if (cancelled) return
          setAssetUrlByKey((prev) => {
            const baseKey = `${it.kind}:${it.index}`
            const next: Record<string, string> = { ...prev }
            const nextBase = (thumbnailUrl || url).trim()
            if (nextBase && next[baseKey] !== nextBase) next[baseKey] = nextBase
            if (url && next[`${baseKey}:orig`] !== url) next[`${baseKey}:orig`] = url
            return next
          })
        })
      )
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [assetUrlByKey, params.agentStepByCanvasId, params.projectId])

  return { assetUrlByKey, setAssetUrlByKey }
}
