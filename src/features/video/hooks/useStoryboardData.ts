import { useState, useEffect, useCallback } from "react"
import type { StoryboardItem, Episode, ApiOutline, VideoStoryboardsResponse } from "../types"
import { normalizeShotsToItems } from "../utils/storyboardUtils"
import { useVideoStoryboardEvents, type VideoStoryboardEvent } from "./useVideoAssetEvents"

type UseStoryboardDataProps = {
  initialItems?: StoryboardItem[]
  storyId?: string
  outlineId?: string
}

export function useStoryboardData({ initialItems = [], storyId: initialStoryId, outlineId: initialOutlineId }: UseStoryboardDataProps) {
  const [items, setItems] = useState<StoryboardItem[]>(initialItems)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [outlineById, setOutlineById] = useState<Record<string, ApiOutline>>({})
  const [activeEpisode, setActiveEpisode] = useState<string>("")
  const [storyId, setStoryId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastLoadedKey, setLastLoadedKey] = useState<string>("")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [reloadTick, setReloadTick] = useState(0)

  const reloadShots = useCallback(
    async (targetOutlineId?: string) => {
      if (!isInitialized) return
      if (!storyId) return
      const outlineId = targetOutlineId ?? activeEpisode
      if (!outlineId) return
      setReloadTick((v) => v + 1)
      setActiveEpisode(outlineId)
    },
    [activeEpisode, isInitialized, storyId]
  )

  // Load initial data
  useEffect(() => {
    let ignore = false
    const loadInitial = async () => {
      setIsLoading(true)
      setLoadError(null)
      setItems([])
      setSelectedItems(new Set())
      try {
        const qs = new URLSearchParams()
        if (initialStoryId) qs.set("storyId", initialStoryId)
        if (initialOutlineId) qs.set("outlineId", initialOutlineId)
        const res = await fetch(`/api/video/storyboards${qs.toString() ? `?${qs.toString()}` : ""}`, { cache: "no-store" })
        const json = (await res.json()) as { ok: boolean; data?: VideoStoryboardsResponse; error?: { message?: string } }
        if (!res.ok || !json?.ok || !json.data) {
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        }
        if (ignore) return

        const outlinesMap: Record<string, ApiOutline> = {}
        for (const o of json.data.outlines) outlinesMap[o.id] = o

        const firstEpisodeId = json.data.outlines[0]?.id ?? ""
        const activeId = firstEpisodeId
        const initialKey = ""

        setOutlineById(outlinesMap)
        setEpisodes(json.data.episodes)
        setStoryId(json.data.storyId)
        setActiveEpisode(activeId)
        setItems([])
        setSelectedItems(new Set())
        setLastLoadedKey(initialKey)
        setIsInitialized(true)
      } catch (e) {
        const anyErr = e as { message?: string }
        if (!ignore) setLoadError(anyErr?.message ?? "加载失败")
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    loadInitial()
    return () => {
      ignore = true
    }
  }, [initialOutlineId, initialStoryId])

  // Switch episode
  useEffect(() => {
    if (!isInitialized) return
    if (!storyId || !activeEpisode) return
    const key = `${storyId}:${activeEpisode}:${reloadTick}`
    if (key === lastLoadedKey) return
    let ignore = false
    const loadShots = async () => {
      setIsLoading(true)
      setLoadError(null)
      setItems([])
      setSelectedItems(new Set())
      try {
        const qs = new URLSearchParams({ storyId, outlineId: activeEpisode })
        const res = await fetch(`/api/video/storyboards?${qs.toString()}`, { cache: "no-store" })
        const json = (await res.json()) as { ok: boolean; data?: VideoStoryboardsResponse; error?: { message?: string } }
        if (!res.ok || !json?.ok || !json.data) {
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        }
        if (ignore) return
        setItems(normalizeShotsToItems(json.data.shots))
        setSelectedItems(new Set())
        setLastLoadedKey(key)
      } catch (e) {
        const anyErr = e as { message?: string }
        if (!ignore) setLoadError(anyErr?.message ?? "加载失败")
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    loadShots()
    return () => {
      ignore = true
    }
  }, [activeEpisode, isInitialized, lastLoadedKey, reloadTick, storyId])

  const onStoryboardEvent = useCallback(
    (ev: VideoStoryboardEvent) => {
      if (!isInitialized) return
      if (!storyId) return
      if (!activeEpisode) return
      if (ev.outlineId !== activeEpisode) return
      void reloadShots()
    },
    [activeEpisode, isInitialized, reloadShots, storyId]
  )

  useVideoStoryboardEvents({
    storyId,
    enabled: isInitialized && Boolean(storyId),
    onEvent: onStoryboardEvent,
    onFallbackTick: () => {
      void reloadShots()
    }
  })

  const updateItemById = useCallback((id: string, updater: (item: StoryboardItem) => StoryboardItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? updater(it) : it)))
  }, [])

  return {
    items,
    setItems,
    updateItemById,
    selectedItems,
    setSelectedItems,
    episodes,
    outlineById,
    activeEpisode,
    setActiveEpisode,
    reloadShots,
    storyId,
    isLoading,
    loadError,
    isInitialized
  }
}
