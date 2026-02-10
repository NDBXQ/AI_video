"use client"

import { useMemo } from "react"
import type { TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import { extractAssetIndex } from "./extractAssetIndex"

export function useTvcMediaPreview(params: {
  agentStepByCanvasId: Partial<Record<TvcPhaseId, TvcAgentStep>>
  assetUrlByKey: Record<string, string>
}): {
  previewImages: Array<{ url: string; category: string; name: string; description: string }>
  previewVideos: Array<{ url: string; title: string; duration: string }>
} {
  const previewImages = useMemo(() => {
    const collect = (phaseId: TvcPhaseId): Array<{ url: string; category: string; name: string; description: string }> => {
      const step = params.agentStepByCanvasId[phaseId]
      const images = step?.content?.images ?? []
      if (!Array.isArray(images)) return []
      return images
        .map((img) => {
          const anyImg = img as Record<string, unknown>
          const index = extractAssetIndex(anyImg) ?? 0
          const url =
            String(
              anyImg["url"] ??
                anyImg["URL"] ??
                anyImg["href"] ??
                (phaseId === "reference_image" ? params.assetUrlByKey[`reference_image:${index}`] : params.assetUrlByKey[`first_frame:${index}`]) ??
                ""
            ).trim()
          const description = String(anyImg["description"] ?? anyImg["prompt"] ?? "").trim()
          const category = String(anyImg["category"] ?? "").trim()
          const name = String(anyImg["name"] ?? "").trim()
          if (!url) return null
          return { url, category, name, description }
        })
        .filter(Boolean) as Array<{ url: string; category: string; name: string; description: string }>
    }

    const step4Images = collect("first_frame")
    const seen = new Set<string>()
    const merged = [...step4Images].filter((x) => {
      if (seen.has(x.url)) return false
      seen.add(x.url)
      return true
    })
    return merged
  }, [params.agentStepByCanvasId, params.assetUrlByKey])

  const previewVideos = useMemo(() => {
    const step5 = params.agentStepByCanvasId.video_clip
    const clips = step5?.content?.videoClips ?? []
    if (!Array.isArray(clips)) return []
    return clips
      .map((c) => {
        const anyClip = c as Record<string, unknown>
        const index = extractAssetIndex(anyClip) ?? 0
        const url = String(
          anyClip["url"] ??
            anyClip["video_url"] ??
            anyClip["href"] ??
            params.assetUrlByKey[`video_clip:${index}:orig`] ??
            params.assetUrlByKey[`video_clip:${index}`] ??
            ""
        ).trim()
        const title = String(anyClip["title"] ?? anyClip["name"] ?? anyClip["description"] ?? "").trim()
        const duration = String(anyClip["duration"] ?? anyClip["duration_sec"] ?? anyClip["durationSeconds"] ?? "").trim()
        if (!url) return null
        return { url, title, duration }
      })
      .filter(Boolean) as Array<{ url: string; title: string; duration: string }>
  }, [params.agentStepByCanvasId, params.assetUrlByKey])

  return { previewImages, previewVideos }
}
