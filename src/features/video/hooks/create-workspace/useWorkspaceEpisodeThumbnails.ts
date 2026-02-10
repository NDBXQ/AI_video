import { useEffect, useMemo, useState } from "react"
import type { ApiErr, ApiOk } from "@/shared/api"
import type { StoryboardItem, VideoStoryboardsResponse } from "@/features/video/types"
import type { Thumbnail } from "@/shared/utils/mediaPreviewUtils"
import { normalizeShotsToItems } from "@/features/video/utils/storyboardUtils"
import { createLocalPreviewSvg } from "@/shared/utils/previewUtils"

type EpisodeRow = {
  outlineId: string
  title: string
  items: StoryboardItem[]
}

export type EpisodeThumbnailRow = {
  outlineId: string
  title: string
  thumbnails: Thumbnail[]
}

export function useWorkspaceEpisodeThumbnails(params: {
  storyId?: string
  enabled: boolean
  previewImageSrcById: Record<string, string>
}): EpisodeThumbnailRow[] {
  const { storyId, enabled, previewImageSrcById } = params
  const [rows, setRows] = useState<EpisodeRow[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const anyEv = e as any
      if (!anyEv?.detail?.refreshStoryboards) return
      setReloadKey((v) => v + 1)
    }
    window.addEventListener("video_reference_images_updated", onUpdated as any)
    return () => window.removeEventListener("video_reference_images_updated", onUpdated as any)
  }, [])

  useEffect(() => {
    if (!enabled || !storyId) return
    let ignore = false
    const load = async () => {
      try {
        const qs = new URLSearchParams({ storyId })
        const baseRes = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
        const baseJson = (await baseRes.json().catch(() => null)) as ApiOk<VideoStoryboardsResponse> | ApiErr | null
        if (!baseRes.ok || !baseJson || (baseJson as ApiErr).ok === false) return
        const okBase = baseJson as ApiOk<VideoStoryboardsResponse>
        const outlines = okBase.data.outlines ?? []
        if (outlines.length === 0) {
          if (!ignore) setRows([])
          return
        }

        const loaded = await Promise.all(
          outlines.map(async (o) => {
            const qs = new URLSearchParams({ storyId, outlineId: o.id })
            const res = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
            const json = (await res.json().catch(() => null)) as ApiOk<VideoStoryboardsResponse> | ApiErr | null
            if (!res.ok || !json || (json as ApiErr).ok === false) return { outlineId: o.id, title: `第${o.sequence}集`, items: [] as StoryboardItem[] }
            const ok = json as ApiOk<VideoStoryboardsResponse>
            return { outlineId: o.id, title: `第${o.sequence}集`, items: normalizeShotsToItems(ok.data.shots ?? []) }
          })
        )
        if (ignore) return
        setRows(loaded.filter((r) => r.items.length > 0))
      } catch {
        if (!ignore) setRows([])
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [enabled, reloadKey, storyId])

  return useMemo(() => {
    const buildThumbs = (items: StoryboardItem[]) => {
      return items.map((it) => {
        const localPreview = (previewImageSrcById[it.id] ?? "").trim()
        const isUrlLike = (v: string) => v.startsWith("http") || v.startsWith("data:")
        const firstFromDb = ((it.frames?.first?.thumbnailUrl ?? "").trim() || (it.frames?.first?.url ?? "").trim()) || createLocalPreviewSvg(`镜 ${it.scene_no}`)
        const firstFrameSrc = isUrlLike(localPreview) ? localPreview : firstFromDb
        const imageSrc = (() => {
          if (isUrlLike(localPreview)) return localPreview
          const dbUrl = (it.frames?.first?.url ?? "").trim()
          const dbThumb = (it.frames?.first?.thumbnailUrl ?? "").trim()
          const isComposed = (u: string) => u.includes("composed_")
          if (dbUrl && isComposed(dbUrl)) return dbUrl
          if (dbThumb && isComposed(dbThumb)) return dbThumb
          return createLocalPreviewSvg(`镜 ${it.scene_no}`)
        })()
        return { id: it.id, title: `镜 ${it.scene_no}`, firstFrameSrc, imageSrc }
      })
    }

    return rows.map((r) => ({ outlineId: r.outlineId, title: r.title, thumbnails: buildThumbs(r.items) }))
  }, [previewImageSrcById, rows])
}
