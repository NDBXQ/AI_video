import { useCallback, useEffect, useState } from "react"
import type { ApiErr, ApiOk } from "@/shared/api"
import type { StoryboardItem, VideoStoryboardsResponse } from "@/features/video/types"
import { normalizeShotsToItems } from "../utils/storyboardUtils"
import { useVideoImageEvents, useVideoStoryboardEvents, type VideoImageEvent, type VideoStoryboardEvent } from "./useVideoAssetEvents"

export function useWorkspaceData({
  storyId,
  outlineId,
  storyboardId,
  activeStoryboardId,
  setActiveStoryboardId
}: {
  storyId?: string
  outlineId?: string
  storyboardId?: string
  activeStoryboardId: string
  setActiveStoryboardId: (id: string | ((prev: string) => string)) => void
}) {
  const [items, setItems] = useState<StoryboardItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [storyboardsVersion, setStoryboardsVersion] = useState(0)
  const [activePreviews, setActivePreviews] = useState<{
    role: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; isGlobal?: boolean; description?: string | null; prompt?: string | null }>
    background: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; isGlobal?: boolean; description?: string | null; prompt?: string | null }>
    item: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; isGlobal?: boolean; description?: string | null; prompt?: string | null }>
  }>({
    role: [],
    background: [],
    item: []
  })

  const onStoryboardEvent = useCallback(
    (ev: VideoStoryboardEvent) => {
      if (!outlineId) return
      if (ev.outlineId !== outlineId) return
      setStoryboardsVersion((v) => v + 1)
      setPreviewVersion((v) => v + 1)
    },
    [outlineId]
  )

  useVideoStoryboardEvents({
    storyId: storyId ?? "",
    enabled: Boolean(storyId) && Boolean(outlineId),
    onEvent: onStoryboardEvent,
    onFallbackTick: () => {
      setStoryboardsVersion((v) => v + 1)
      setPreviewVersion((v) => v + 1)
    }
  })

  const onImageEvent = useCallback(
    (ev: VideoImageEvent) => {
      if (ev.storyboardId && ev.storyboardId !== activeStoryboardId) return
      setPreviewVersion((v) => v + 1)
    },
    [activeStoryboardId]
  )

  useVideoImageEvents({
    storyId: storyId ?? "",
    enabled: Boolean(storyId),
    includeGlobal: true,
    onEvent: onImageEvent,
    onFallbackTick: () => {
      setPreviewVersion((v) => v + 1)
    }
  })

  // Load Storyboards
  useEffect(() => {
    if (!storyId || !outlineId) return
    let ignore = false
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const qs = new URLSearchParams({ storyId, outlineId })
        const res = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
        const json = (await res.json()) as ApiOk<VideoStoryboardsResponse> | ApiErr
        if (!res.ok || !json || (json as ApiErr).ok === false) {
          const errJson = json as ApiErr
          throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
        }
        const okJson = json as ApiOk<VideoStoryboardsResponse>
        const nextItems = normalizeShotsToItems(okJson.data.shots)
        if (ignore) return
        setItems(nextItems)
        setActiveStoryboardId((prev) => {
          if (prev && nextItems.some((it) => it.id === prev)) return prev
          if (storyboardId && nextItems.some((it) => it.id === storyboardId)) return storyboardId
          return nextItems[0]?.id ?? ""
        })
      } catch (e) {
        const anyErr = e as { message?: string }
        if (!ignore) setLoadError(anyErr?.message ?? "加载失败")
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [outlineId, storyboardId, storyId, setActiveStoryboardId, storyboardsVersion])

  // Load Previews
  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!storyId || !activeStoryboardId) {
        setActivePreviews({ role: [], background: [], item: [] })
        return
      }
      try {
        const activeItem = items.find((it) => it.id === activeStoryboardId) ?? null
        const targetBackground = typeof activeItem?.shot_content?.background?.background_name === "string" ? activeItem.shot_content.background.background_name.trim() : ""
        const targetRoles = new Set<string>(
          (activeItem?.shot_content?.roles ?? [])
            .map((r) => (r && typeof r.role_name === "string" ? r.role_name.trim() : ""))
            .filter(Boolean)
        )
        const targetItems = new Set<string>(
          [...(activeItem?.shot_content?.role_items ?? []), ...(activeItem?.shot_content?.other_items ?? [])]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)
        )

        const qs = new URLSearchParams({
          storyId,
          storyboardIds: activeStoryboardId,
          includeGlobal: "true",
          limit: "200",
          offset: "0"
        })
        const res = await fetch(`/api/video-creation/images?${qs.toString()}`, { cache: "no-store" })
        const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
        if (!res.ok || !json?.ok || !Array.isArray(json.data?.items)) {
          if (!ignore) setActivePreviews({ role: [], background: [], item: [] })
          return
        }
        const next = { role: [] as any[], background: [] as any[], item: [] as any[] }
        const seen = { role: new Set<string>(), background: new Set<string>(), item: new Set<string>() }
        for (const row of json.data.items) {
          const category = typeof row.category === "string" ? row.category : "reference"
          const rawStoryboardId = typeof row.storyboardId === "string" ? row.storyboardId : null
          const name = typeof row.name === "string" ? row.name.trim() : ""
          const kind = category === "role" ? "role" : category === "item" ? "item" : "background"
          const isNarrator = name === "旁白" || name.toLowerCase() === "narrator"
          if (kind === "role" && isNarrator) continue

          if (!rawStoryboardId) {
            if (!activeItem) continue
            if (!name) continue
            if (kind === "background" && targetBackground && name !== targetBackground) continue
            if (kind === "role" && !targetRoles.has(name)) continue
            if (kind === "item" && !targetItems.has(name)) continue
          }

          const entry = {
            id: String(row.id ?? `${activeStoryboardId}:${row.name ?? ""}:${category}`),
            name: typeof row.name === "string" ? row.name : category,
            url: typeof row.url === "string" ? row.url : "",
            thumbnailUrl: typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : null,
            category,
            storyboardId: rawStoryboardId ?? activeStoryboardId,
            isGlobal: !rawStoryboardId,
            description: typeof row.description === "string" ? row.description : null,
            prompt: typeof row.prompt === "string" ? row.prompt : null
          }
          if (!entry.url) continue
          if (kind === "role") {
            if (seen.role.has(entry.name)) continue
            seen.role.add(entry.name)
            next.role.push(entry)
          } else if (kind === "item") {
            if (seen.item.has(entry.name)) continue
            seen.item.add(entry.name)
            next.item.push(entry)
          } else {
            if (seen.background.has(entry.name)) continue
            seen.background.add(entry.name)
            next.background.push(entry)
          }
        }
        if (!ignore) setActivePreviews(next)
      } catch {
        if (!ignore) setActivePreviews({ role: [], background: [], item: [] })
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [activeStoryboardId, items, storyId, previewVersion])

  return { items, setItems, isLoading, loadError, activePreviews }
}
