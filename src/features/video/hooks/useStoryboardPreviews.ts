import { useEffect, useMemo, useState } from "react"
import type { StoryboardItem } from "../types"

export type PreviewImage = {
  id: string
  name: string
  url: string
  thumbnailUrl?: string | null
  category: string
  storyboardId?: string | null
  description?: string | null
  prompt?: string | null
}

export type StoryboardPreviewsById = Record<string, { role: PreviewImage[]; background: PreviewImage[]; item: PreviewImage[] }>

export function useStoryboardPreviews(params: { storyId?: string; items: StoryboardItem[] }): StoryboardPreviewsById {
  const { storyId, items } = params
  const [previewsById, setPreviewsById] = useState<StoryboardPreviewsById>({})
  const [refreshKey, setRefreshKey] = useState(0)

  const storyboardIds = useMemo(() => items.map((it) => it.id).filter(Boolean), [items])
  const nameIndex = useMemo(() => {
    const index = {
      background: new Map<string, Set<string>>(),
      role: new Map<string, Set<string>>(),
      item: new Map<string, Set<string>>()
    }
    const add = (kind: "background" | "role" | "item", name: string, storyboardId: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const m = index[kind]
      const set = m.get(trimmed) ?? new Set<string>()
      set.add(storyboardId)
      m.set(trimmed, set)
    }
    for (const it of items) {
      if (!it?.id) continue
      const bgName = it.shot_content?.background?.background_name
      if (typeof bgName === "string") add("background", bgName, it.id)
      for (const r of it.shot_content?.roles ?? []) {
        if (r && typeof r.role_name === "string") add("role", r.role_name, it.id)
      }
      for (const v of it.shot_content?.role_items ?? []) {
        if (typeof v === "string") add("item", v, it.id)
      }
      for (const v of it.shot_content?.other_items ?? []) {
        if (typeof v === "string") add("item", v, it.id)
      }
    }
    return index
  }, [items])

  useEffect(() => {
    const onRefresh = () => setRefreshKey((v) => v + 1)
    window.addEventListener("video_reference_images_updated", onRefresh as EventListener)
    return () => window.removeEventListener("video_reference_images_updated", onRefresh as EventListener)
  }, [])

  useEffect(() => {
    let ignore = false
    const loadPreviews = async () => {
      if (!storyId) return
      if (storyboardIds.length === 0) {
        setPreviewsById({})
        return
      }
      const qs = new URLSearchParams({
        storyId,
        storyboardIds: storyboardIds.join(","),
        includeGlobal: "true",
        limit: "200",
        offset: "0"
      })
      const res = await fetch(`/api/video-creation/images?${qs.toString()}`, { cache: "no-store" })
      const json = (await res.json()) as { ok: boolean; data?: { items?: any[] } }
      if (!res.ok || !json?.ok || !json.data?.items || !Array.isArray(json.data.items)) {
        if (!ignore) setPreviewsById({})
        return
      }
      const next: StoryboardPreviewsById = {}
      const existingByStoryboard = new Map<string, { role: Set<string>; background: Set<string>; item: Set<string> }>()
      const globalRows: any[] = []

      const ensure = (sid: string) => {
        if (!next[sid]) next[sid] = { role: [], background: [], item: [] }
        const cur = existingByStoryboard.get(sid) ?? { role: new Set<string>(), background: new Set<string>(), item: new Set<string>() }
        existingByStoryboard.set(sid, cur)
        return cur
      }

      for (const row of json.data.items) {
        const storyboardId = typeof row.storyboardId === "string" ? row.storyboardId : null
        const category = typeof row.category === "string" ? row.category : "reference"
        const entry: PreviewImage = {
          id: String(row.id ?? `${storyboardId ?? "global"}:${row.name ?? ""}:${category}`),
          name: typeof row.name === "string" ? row.name : category,
          url: typeof row.url === "string" ? row.url : "",
          thumbnailUrl: typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : null,
          category,
          storyboardId,
          description: typeof row.description === "string" ? row.description : null,
          prompt: typeof row.prompt === "string" ? row.prompt : null
        }
        if (!entry.url) continue
        if (!storyboardId) {
          globalRows.push(entry)
          continue
        }
        const seen = ensure(storyboardId)
        if (category === "role") {
          if (!seen.role.has(entry.name)) {
            seen.role.add(entry.name)
            next[storyboardId].role.push(entry)
          }
        } else if (category === "item") {
          if (!seen.item.has(entry.name)) {
            seen.item.add(entry.name)
            next[storyboardId].item.push(entry)
          }
        } else if (category === "background" || category === "reference") {
          if (!seen.background.has(entry.name)) {
            seen.background.add(entry.name)
            next[storyboardId].background.push(entry)
          }
        }
      }

      for (const entry of globalRows) {
        const name = entry.name
        const category = entry.category === "reference" ? "background" : entry.category
        const kind = category === "role" ? "role" : category === "item" ? "item" : "background"
        const targets = nameIndex[kind].get(name)
        if (!targets || targets.size === 0) continue
        for (const storyboardId of targets) {
          const seen = ensure(storyboardId)
          if (kind === "role") {
            if (seen.role.has(name)) continue
            seen.role.add(name)
            next[storyboardId].role.push({ ...entry, storyboardId })
          } else if (kind === "item") {
            if (seen.item.has(name)) continue
            seen.item.add(name)
            next[storyboardId].item.push({ ...entry, storyboardId })
          } else {
            if (seen.background.has(name)) continue
            seen.background.add(name)
            next[storyboardId].background.push({ ...entry, storyboardId })
          }
        }
      }

      if (!ignore) setPreviewsById(next)
    }
    void loadPreviews()
    return () => {
      ignore = true
    }
  }, [nameIndex, storyId, storyboardIds, refreshKey])

  return previewsById
}
