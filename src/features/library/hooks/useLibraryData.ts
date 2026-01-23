import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getMyStories } from "../actions/library"
import { listPublicResources, getPublicResourceStats } from "../actions/public"
import { MOCK_ITEMS, MOCK_COUNTS, PUBLIC_COUNTS } from "../lib/mockItems"
import type { LibraryItem } from "../components/LibraryCard"
import type { Scope } from "../components/ScopeTabs"
import type { ViewMode } from "../components/LibraryToolbar"
import {
  normalizeScope,
  normalizeCategory,
  normalizeView,
  mapCategoryToPublicType,
  mapPublicResourceToItem,
  MY_CATEGORIES,
  PUBLIC_CATEGORIES
} from "../utils/libraryUtils"

export function useLibraryData() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL State
  const [scope, setScope] = useState<Scope>(() => normalizeScope(searchParams.get("scope")))
  const [category, setCategory] = useState<string>(() => normalizeCategory(normalizeScope(searchParams.get("scope")), searchParams.get("category")))
  const [view, setView] = useState<ViewMode>(() => normalizeView(searchParams.get("view")))
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")

  // Data State
  const [myItems, setMyItems] = useState<LibraryItem[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [publicItems, setPublicItems] = useState<LibraryItem[]>([])
  const [publicCounts, setPublicCounts] = useState<Record<string, number>>({})
  const [publicLoading, setPublicLoading] = useState(false)

  const updateUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null) {
          next.delete(key)
          return
        }
        next.set(key, value)
      })
      const qs = next.toString()
      router.replace(qs ? `?${qs}` : "?", { scroll: false })
    },
    [router, searchParams]
  )

  const loadMyStories = useCallback(async (q: string) => {
    setMyLoading(true)
    try {
      const items = await getMyStories(q)
      setMyItems(items)
    } catch {
      setMyItems([])
    } finally {
      setMyLoading(false)
    }
  }, [])

  // Load My Stories
  useEffect(() => {
    if (scope !== "my") return
    void loadMyStories(query)
  }, [loadMyStories, query, scope])

  // Load Public Resources
  useEffect(() => {
    if (scope !== "public") return
    const type = mapCategoryToPublicType(category)
    setPublicLoading(true)
    listPublicResources({
      type,
      search: query,
      sort: "recent",
      limit: 60,
      offset: 0
    })
      .then((res) => {
        setPublicItems(res.items.map(mapPublicResourceToItem))
      })
      .catch(() => {
        setPublicItems([])
      })
      .finally(() => {
        setPublicLoading(false)
      })
  }, [category, query, scope])

  // Load Public Stats
  useEffect(() => {
    if (scope !== "public") return
    getPublicResourceStats()
      .then((stats) => {
        setPublicCounts({
          all: stats.all,
          roles: stats.character,
          backgrounds: stats.background,
          props: stats.props,
        })
      })
      .catch(() => {
        setPublicCounts({})
      })
  }, [scope])

  const categories = scope === "public" ? PUBLIC_CATEGORIES : MY_CATEGORIES

  const counts = useMemo(() => {
    if (scope === "public") return { ...PUBLIC_COUNTS, ...publicCounts }

    const nextCounts = { ...(MOCK_COUNTS as Record<string, number>) }
    return nextCounts
  }, [publicCounts, scope])

  const displayItems = useMemo(() => {
    if (scope === "my") return myItems
    if (scope === "public") return publicItems

    return MOCK_ITEMS.filter((item) => {
      if ((item.scope ?? "my") !== scope) return false
      if (category && item.type !== category) return false
      if (query) {
        const hay = `${item.title} ${item.subtitle ?? ""}`.toLowerCase()
        if (!hay.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [category, myItems, publicItems, query, scope])

  const refreshPublicData = useCallback(async () => {
    const type = mapCategoryToPublicType(category)
    const [list, stats] = await Promise.all([
      listPublicResources({ type, search: query, sort: "recent", limit: 60, offset: 0 }),
      getPublicResourceStats()
    ])
    setPublicItems(list.items.map(mapPublicResourceToItem))
    setPublicCounts({
      all: stats.all,
      roles: stats.character,
      backgrounds: stats.background,
      props: stats.props
    })
  }, [category, query])

  return {
    scope,
    setScope,
    category,
    setCategory,
    view,
    setView,
    query,
    setQuery,
    updateUrl,
    myItems,
    publicItems,
    counts,
    categories,
    displayItems,
    loading: myLoading || publicLoading,
    refreshPublicData,
    loadMyStories,
  }
}
