import { useEffect, useState } from "react"
import type { ApiErr, ApiOk } from "@/shared/api"
import type { VideoStoryboardsResponse } from "@/features/video/types"

export function useWorkspaceEpisodeLabel(params: {
  storyId?: string
  outlineId?: string
  enabled: boolean
}): string | null {
  const { storyId, outlineId, enabled } = params
  const [labelByKey, setLabelByKey] = useState<Record<string, string>>({})
  const key = enabled && storyId && outlineId ? `${storyId}:${outlineId}` : null

  useEffect(() => {
    if (!enabled || !storyId || !outlineId) return
    let ignore = false
    const load = async () => {
      try {
        const qs = new URLSearchParams({ storyId })
        const res = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
        const json = (await res.json().catch(() => null)) as ApiOk<VideoStoryboardsResponse> | ApiErr | null
        if (!res.ok || !json || (json as ApiErr).ok === false) return
        const ok = json as ApiOk<VideoStoryboardsResponse>
        const outlines = ok.data.outlines ?? []
        const current = outlines.find((o) => o.id === outlineId) ?? null
        const nextLabel = current ? `第${current.sequence}集` : null
        if (ignore || !nextLabel) return
        setLabelByKey((prev) => (prev[`${storyId}:${outlineId}`] === nextLabel ? prev : { ...prev, [`${storyId}:${outlineId}`]: nextLabel }))
      } catch {}
    }
    void load()
    return () => {
      ignore = true
    }
  }, [enabled, outlineId, storyId])

  return key ? labelByKey[key] ?? null : null
}
