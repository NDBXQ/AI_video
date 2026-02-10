import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getMyStories } from "@/server/actions/library/library"
import { listPublicResources, getPublicResourceStats, listSharedResources, getSharedResourceStats } from "@/server/actions/library/public"
import { MOCK_ITEMS, MOCK_COUNTS, PUBLIC_COUNTS } from "../lib/mockItems"
import type { LibraryItem } from "@/shared/contracts/library/libraryItem"
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
  const pageSize = 60

  // URL State
  const [scope, setScope] = useState<Scope>(() => normalizeScope(searchParams.get("scope")))
  const [category, setCategory] = useState<string>(() => normalizeCategory(normalizeScope(searchParams.get("scope")), searchParams.get("category")))
  const [view, setView] = useState<ViewMode>(() => normalizeView(searchParams.get("view")))
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")

  // Data State
  const [myItems, setMyItems] = useState<LibraryItem[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [libraryCounts, setLibraryCounts] = useState<Record<string, number>>({})
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryTotal, setLibraryTotal] = useState(0)
  const [libraryHasMore, setLibraryHasMore] = useState(false)
  const [libraryLoadingMore, setLibraryLoadingMore] = useState(false)

  const [sharedItems, setSharedItems] = useState<LibraryItem[]>([])
  const [sharedCounts, setSharedCounts] = useState<Record<string, number>>({})
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedTotal, setSharedTotal] = useState(0)
  const [sharedHasMore, setSharedHasMore] = useState(false)
  const [sharedLoadingMore, setSharedLoadingMore] = useState(false)

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

  // Load Resource Library
  useEffect(() => {
    if (scope !== "library") return
    let cancelled = false
    const type = mapCategoryToPublicType(category)
    setLibraryLoading(true)
    setLibraryLoadingMore(false)
    setLibraryTotal(0)
    setLibraryHasMore(false)
    listPublicResources({ type, search: query, sort: "recent", limit: pageSize, offset: 0 })
      .then((res) => {
        if (cancelled) return
        const nextItems = res.items.map((r) => mapPublicResourceToItem(r, "library"))
        setLibraryItems(nextItems)
        setLibraryTotal(res.total)
        setLibraryHasMore(nextItems.length < res.total)
      })
      .catch(() => {
        if (cancelled) return
        setLibraryItems([])
        setLibraryTotal(0)
        setLibraryHasMore(false)
      })
      .finally(() => {
        if (cancelled) return
        setLibraryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category, pageSize, query, scope])

  // Load Resource Library Stats
  useEffect(() => {
    if (scope !== "library") return
    getPublicResourceStats()
      .then((stats) => {
        setLibraryCounts({
          all: stats.all,
          roles: stats.character,
          backgrounds: stats.background,
          props: stats.props,
          audios: stats.audio,
          videos: stats.video,
        })
      })
      .catch(() => {
        setLibraryCounts({})
      })
  }, [scope])

  // Load Shared Resources
  useEffect(() => {
    if (scope !== "shared") return
    let cancelled = false
    const type = mapCategoryToPublicType(category)
    setSharedLoading(true)
    setSharedLoadingMore(false)
    setSharedTotal(0)
    setSharedHasMore(false)
    listSharedResources({ type, search: query, sort: "recent", limit: pageSize, offset: 0 })
      .then((res) => {
        if (cancelled) return
        const nextItems = res.items.map((r) => mapPublicResourceToItem(r, "shared"))
        setSharedItems(nextItems)
        setSharedTotal(res.total)
        setSharedHasMore(nextItems.length < res.total)
      })
      .catch(() => {
        if (cancelled) return
        setSharedItems([])
        setSharedTotal(0)
        setSharedHasMore(false)
      })
      .finally(() => {
        if (cancelled) return
        setSharedLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category, pageSize, query, scope])

  // Load Shared Stats
  useEffect(() => {
    if (scope !== "shared") return
    getSharedResourceStats()
      .then((stats) => {
        setSharedCounts({
          all: stats.all,
          roles: stats.character,
          backgrounds: stats.background,
          props: stats.props,
          audios: stats.audio,
          videos: stats.video,
        })
      })
      .catch(() => {
        setSharedCounts({})
      })
  }, [scope])

  const categories = scope === "library" || scope === "shared" ? PUBLIC_CATEGORIES : MY_CATEGORIES

  const counts = useMemo(() => {
    if (scope === "library") return { ...PUBLIC_COUNTS, ...libraryCounts }
    if (scope === "shared") return { ...PUBLIC_COUNTS, ...sharedCounts }

    const nextCounts = { ...(MOCK_COUNTS as Record<string, number>) }
    return nextCounts
  }, [libraryCounts, scope, sharedCounts])

  const displayItems = useMemo(() => {
    if (scope === "my") return myItems
    if (scope === "library") return libraryItems
    if (scope === "shared") return sharedItems

    return MOCK_ITEMS.filter((item) => {
      if ((item.scope ?? "my") !== scope) return false
      if (category && item.type !== category) return false
      if (query) {
        const hay = `${item.title} ${item.subtitle ?? ""}`.toLowerCase()
        if (!hay.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [category, libraryItems, myItems, query, scope, sharedItems])

  const refreshPublicData = useCallback(async () => {
    const type = mapCategoryToPublicType(category)
    if (scope === "library") {
      const [list, stats] = await Promise.all([
        listPublicResources({ type, search: query, sort: "recent", limit: pageSize, offset: 0 }),
        getPublicResourceStats()
      ])
      setLibraryItems(list.items.map((r) => mapPublicResourceToItem(r, "library")))
      setLibraryTotal(list.total)
      setLibraryHasMore(list.items.length < list.total)
      setLibraryCounts({
        all: stats.all,
        roles: stats.character,
        backgrounds: stats.background,
        props: stats.props,
        audios: stats.audio,
        videos: stats.video
      })
      return
    }
    if (scope === "shared") {
      const [list, stats] = await Promise.all([
        listSharedResources({ type, search: query, sort: "recent", limit: pageSize, offset: 0 }),
        getSharedResourceStats()
      ])
      setSharedItems(list.items.map((r) => mapPublicResourceToItem(r, "shared")))
      setSharedTotal(list.total)
      setSharedHasMore(list.items.length < list.total)
      setSharedCounts({
        all: stats.all,
        roles: stats.character,
        backgrounds: stats.background,
        props: stats.props,
        audios: stats.audio,
        videos: stats.video
      })
      return
    }
  }, [category, pageSize, query, scope])

  const loadMorePublic = useCallback(async () => {
    if (scope !== "library" && scope !== "shared") return
    const type = mapCategoryToPublicType(category)
    if (scope === "library") {
      if (libraryLoading || libraryLoadingMore) return
      if (!libraryHasMore) return
      const nextOffset = libraryItems.length
      setLibraryLoadingMore(true)
      try {
        const res = await listPublicResources({ type, search: query, sort: "recent", limit: pageSize, offset: nextOffset })
        const nextItems = res.items.map((r) => mapPublicResourceToItem(r, "library"))
        setLibraryItems((prev) => [...prev, ...nextItems])
        setLibraryTotal(res.total)
        setLibraryHasMore(nextOffset + nextItems.length < res.total)
      } finally {
        setLibraryLoadingMore(false)
      }
      return
    }
    if (sharedLoading || sharedLoadingMore) return
    if (!sharedHasMore) return
    const nextOffset = sharedItems.length
    setSharedLoadingMore(true)
    try {
      const res = await listSharedResources({ type, search: query, sort: "recent", limit: pageSize, offset: nextOffset })
      const nextItems = res.items.map((r) => mapPublicResourceToItem(r, "shared"))
      setSharedItems((prev) => [...prev, ...nextItems])
      setSharedTotal(res.total)
      setSharedHasMore(nextOffset + nextItems.length < res.total)
    } finally {
      setSharedLoadingMore(false)
    }
  }, [
    category,
    libraryHasMore,
    libraryItems.length,
    libraryLoading,
    libraryLoadingMore,
    pageSize,
    query,
    scope,
    sharedHasMore,
    sharedItems.length,
    sharedLoading,
    sharedLoadingMore
  ])

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
    publicItems: scope === "shared" ? sharedItems : libraryItems,
    publicTotal: scope === "shared" ? sharedTotal : libraryTotal,
    publicOffset: 0,
    publicHasMore: scope === "shared" ? sharedHasMore : libraryHasMore,
    publicLoadingMore: scope === "shared" ? sharedLoadingMore : libraryLoadingMore,
    loadMorePublic,
    counts,
    categories,
    displayItems,
    loading: myLoading || libraryLoading || sharedLoading,
    refreshPublicData,
    loadMyStories,
  }
}
