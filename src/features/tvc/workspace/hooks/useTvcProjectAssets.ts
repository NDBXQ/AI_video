"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type TvcProjectAssetItem = {
  kind: string
  ordinal: number
  url: string
  thumbnailUrl?: string
  isUserProvided?: boolean
  meta?: Record<string, unknown>
  updatedAtMs: number
  cursor: string
}

function safeParseInt(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) ? n : 0
}

export function useTvcProjectAssets(projectId: string | null): {
  items: TvcProjectAssetItem[]
  loading: boolean
} {
  const [items, setItems] = useState<TvcProjectAssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const tokenRef = useRef(0)

  useEffect(() => {
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => {
            void Promise.resolve().then(cb)
          }
    const pid = (projectId ?? "").trim()
    if (!pid) {
      schedule(() => {
        setItems([])
        setLoading(false)
      })
      return
    }

    const token = (tokenRef.current += 1)
    schedule(() => {
      setItems([])
      setLoading(true)
    })
    void (async () => {
      const out: TvcProjectAssetItem[] = []
      let cursor = ""
      let guard = 0
      while (guard++ < 20) {
        const url = cursor ? `/api/tvc/projects/${encodeURIComponent(pid)}/assets?cursor=${encodeURIComponent(cursor)}` : `/api/tvc/projects/${encodeURIComponent(pid)}/assets`
        const res = await fetch(url, { method: "GET", cache: "no-store" }).catch(() => null)
        const json = (await res?.json().catch(() => null)) as any
        if (tokenRef.current !== token) return
        if (!res || !res.ok || !json?.ok) break

        const list = Array.isArray(json?.data?.items) ? (json.data.items as any[]) : []
        for (const r of list) {
          const kind = String(r?.kind ?? "").trim()
          const ordinal = safeParseInt(r?.ordinal ?? r?.assetOrdinal ?? r?.index)
          const url = String(r?.url ?? "").trim()
          const thumbnailUrl = String(r?.thumbnailUrl ?? "").trim()
          const updatedAtMs = typeof r?.updatedAtMs === "number" ? (Number.isFinite(r.updatedAtMs) ? Math.trunc(r.updatedAtMs) : 0) : 0
          const cursor = String(r?.cursor ?? "").trim()
          if (!kind || !ordinal) continue
          if (!url && !thumbnailUrl && kind !== "script" && kind !== "storyboards" && kind !== "clarification") continue
          out.push({
            kind,
            ordinal,
            url,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            ...(r?.isUserProvided ? { isUserProvided: true } : {}),
            ...(r?.meta && typeof r.meta === "object" ? { meta: r.meta as any } : {}),
            updatedAtMs,
            cursor
          })
        }

        const nextCursor = String(json?.data?.cursor ?? "").trim()
        if (!nextCursor) break
        if (nextCursor === cursor) break
        cursor = nextCursor
        if (list.length < 200) break
      }

      if (tokenRef.current !== token) return
      schedule(() => {
        setItems(out)
        setLoading(false)
      })
    })()
  }, [projectId])

  const deduped = useMemo(() => {
    const map = new Map<string, TvcProjectAssetItem>()
    for (const it of items) {
      const key = `${it.kind}:${it.ordinal}`
      const prev = map.get(key)
      if (!prev) {
        map.set(key, it)
        continue
      }
      if (it.updatedAtMs > prev.updatedAtMs) {
        map.set(key, it)
        continue
      }
      if (it.updatedAtMs === prev.updatedAtMs && it.cursor && it.cursor !== prev.cursor) {
        map.set(key, it)
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
      return a.ordinal - b.ordinal
    })
  }, [items])

  return { items: deduped, loading }
}
