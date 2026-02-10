"use client"

import type { ReactElement } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ScopeTabs } from "./components/ScopeTabs"
import { MyTypeTabs, type MyContentType } from "./components/MyTypeTabs"
import { CategorySidebar } from "./components/CategorySidebar"
import { LibraryToolbar } from "./components/LibraryToolbar"
import { LibraryGrid } from "./components/LibraryGrid"
import { MyStoriesGroupedGrid } from "./components/MyStoriesGroupedGrid"
import { UploadResourceModal } from "./components/UploadResourceModal"
import { AiGenerateResourceModal } from "./components/AiGenerateResourceModal"
import { BulkActionBar } from "./components/BulkActionBar"
import { PublicResourcePreviewModal } from "./components/PublicResourcePreviewModal"
import { StoryContentModal } from "./components/StoryContentModal"
import { ConfirmModal } from "@/shared/ui/ConfirmModal"
import { deleteStory } from "@/server/actions/library/library"
import { deleteTvcProject } from "@/server/actions/library/tvc"
import { aiGeneratePublicResource } from "@/server/actions/library/ai-generate"
import type { LibraryItem } from "@/shared/contracts/library/libraryItem"
import styles from "./ContentLibraryPage.module.css"
import { useLibraryData } from "./hooks/useLibraryData"
import { useLibrarySelection } from "./hooks/useLibrarySelection"
import { mapAiTypeToDbType } from "./utils/libraryUtils"
import { postFormDataWithProgress, putBlobWithProgress } from "@/shared/utils/uploadWithProgress"

export function ContentLibraryPage(): ReactElement {
  const router = useRouter()
  const gridWrapRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  
  const {
    scope, setScope,
    category, setCategory,
    view, setView,
    query, setQuery,
    updateUrl,
    displayItems,
    publicTotal,
    publicHasMore,
    publicLoadingMore,
    loadMorePublic,
    counts,
    categories,
    loading,
    refreshPublicData,
    loadMyStories
  } = useLibraryData()

  const {
    selectedIds,
    setSelectedIds,
    toggleSelected,
    clearSelected,
    previewItem,
    setPreviewItem,
    bulkDeleting,
    handleBulkDelete
  } = useLibrarySelection(scope, category)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [myType, setMyType] = useState<MyContentType>("standard")
  const [storyDeleteConfirm, setStoryDeleteConfirm] = useState<{ ids: string[]; tvcCount: number; standardCount: number } | null>(null)
  const [storyDeleting, setStoryDeleting] = useState(false)
  const [publicDeleteConfirm, setPublicDeleteConfirm] = useState<{ ids: string[] } | null>(null)
  const [storyContentItem, setStoryContentItem] = useState<{ id: string; title?: string } | null>(null)
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (scope !== "my") setMyType("standard")
  }, [scope])

  useEffect(() => {
    if (scope !== "my") return
    clearSelected()
    setStoryDeleteConfirm(null)
  }, [clearSelected, myType, query, scope])

  useEffect(() => {
    if (scope !== "library" && scope !== "shared") return
    if (!publicHasMore) return
    const root = gridWrapRef.current
    const target = loadMoreSentinelRef.current
    if (!root || !target) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (loading || publicLoadingMore || !publicHasMore) return
        void loadMorePublic()
      },
      { root, rootMargin: "220px 0px" }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [loadMorePublic, loading, publicHasMore, publicLoadingMore, scope])

  const handleItemClick = useCallback(
    (item: LibraryItem) => {
      if (scope !== "my") return
      if (item.type === "tvc") {
        router.push(`/tvc?projectId=${encodeURIComponent(item.id)}`)
        return
      }
      const stage = item.progressStage ?? "outline"
      if (stage === "outline") {
        router.push(`/script/workspace/${item.id}`)
        return
      }
      router.push(`/video?storyId=${item.id}&tab=list`)
    },
    [router, scope]
  )

  const myFilteredItems =
    scope !== "my"
      ? displayItems
      : myType === "tvc"
        ? displayItems.filter((i) => i.type === "tvc")
        : displayItems.filter((i) => i.type !== "tvc")

  const myItemTypeById = useMemo(() => {
    const map = new Map<string, LibraryItem["type"]>()
    if (scope !== "my") return map
    for (const item of displayItems) map.set(item.id, item.type)
    return map
  }, [displayItems, scope])

  const mySelectedCounts = useMemo(() => {
    if (scope !== "my") return { tvcCount: 0, standardCount: 0 }
    let tvcCount = 0
    let standardCount = 0
    for (const id of selectedIds) {
      const t = myItemTypeById.get(id)
      if (t === "tvc") tvcCount += 1
      else standardCount += 1
    }
    return { tvcCount, standardCount }
  }, [myItemTypeById, scope, selectedIds])

  const myVisibleIds = useMemo(() => {
    if (scope !== "my") return []
    return myFilteredItems.map((i) => i.id)
  }, [myFilteredItems, scope])

  const myAllVisibleSelected = useMemo(() => {
    if (scope !== "my") return false
    if (myVisibleIds.length <= 0) return false
    for (const id of myVisibleIds) {
      if (!selectedIds.has(id)) return false
    }
    return true
  }, [myVisibleIds, scope, selectedIds])

  const toggleSelectAllMyVisible = useCallback(() => {
    if (scope !== "my") return
    if (myVisibleIds.length <= 0) return
    if (myAllVisibleSelected) {
      clearSelected()
      return
    }
    setSelectedIds(new Set(myVisibleIds))
  }, [clearSelected, myAllVisibleSelected, myVisibleIds, scope, setSelectedIds])

  const openMyStoriesDeleteConfirm = useCallback(() => {
    if (selectedIds.size <= 0) return
    const ids = Array.from(selectedIds)
    let tvcCount = 0
    let standardCount = 0
    for (const id of ids) {
      const t = myItemTypeById.get(id)
      if (t === "tvc") tvcCount += 1
      else standardCount += 1
    }
    setStoryDeleteConfirm({ ids, tvcCount, standardCount })
  }, [myItemTypeById, selectedIds])

  const confirmMyStoriesDelete = useCallback(async () => {
    const ids = storyDeleteConfirm?.ids ?? []
    if (ids.length <= 0 || storyDeleting) return
    setStoryDeleting(true)
    try {
      const failedIds: string[] = []
      const concurrency = Math.max(1, Math.min(6, ids.length))
      let cursor = 0
      await Promise.all(
        Array.from({ length: concurrency }).map(async () => {
          while (true) {
            const i = cursor
            cursor += 1
            if (i >= ids.length) return
            const id = ids[i]!
            try {
              const t = myItemTypeById.get(id)
              const res = t === "tvc" ? await deleteTvcProject(id) : await deleteStory(id)
              if (!res.success) throw new Error("DELETE_FAILED")
            } catch {
              failedIds.push(id)
            }
          }
        })
      )
      await loadMyStories(query)
      setSelectedIds(new Set(failedIds))
      setStoryDeleteConfirm(null)
      const okCount = ids.length - failedIds.length
      if (failedIds.length > 0) {
        setNotice({ type: "error", message: `删除完成：成功 ${okCount}/${ids.length}，失败 ${failedIds.length}` })
      } else {
        const tvcCount = storyDeleteConfirm?.tvcCount ?? 0
        const standardCount = storyDeleteConfirm?.standardCount ?? 0
        const title = tvcCount > 0 && standardCount > 0 ? "内容" : tvcCount > 0 ? "项目" : "剧本"
        setNotice({ type: "info", message: `已删除 ${okCount} 个${title}` })
      }
    } finally {
      setStoryDeleting(false)
    }
  }, [loadMyStories, myItemTypeById, query, setSelectedIds, storyDeleteConfirm, storyDeleting])

  const openPublicBulkDeleteConfirm = useCallback(() => {
    if (scope !== "library") return
    if (selectedIds.size <= 0) return
    setPublicDeleteConfirm({ ids: Array.from(selectedIds) })
  }, [scope, selectedIds])

  const confirmPublicBulkDelete = useCallback(async () => {
    const ids = publicDeleteConfirm?.ids ?? []
    if (ids.length <= 0) return
    const deletedCount = await handleBulkDelete(ids, refreshPublicData)
    setPublicDeleteConfirm(null)
    setNotice({ type: "info", message: `已删除 ${deletedCount ?? 0} 项素材` })
  }, [handleBulkDelete, publicDeleteConfirm, refreshPublicData])

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.contentWrap}>
            {notice ? (
              <div className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeInfo}`} role="status">
                {notice.message}
              </div>
            ) : null}
            <div className={styles.topRow}>
              <div className={styles.scopeWrap}>
                <ScopeTabs
                  value={scope}
                  onChange={(next) => {
                    setScope(next)
                    const nextCategory = next === "my" ? "draft" : "all"
                    setCategory(nextCategory)
                    updateUrl({ scope: next, category: nextCategory })
                  }}
                />
              </div>
              {scope === "my" ? <MyTypeTabs value={myType} onChange={setMyType} /> : null}

              <LibraryToolbar
                view={view}
                onViewChange={(next) => {
                  setView(next)
                  updateUrl({ view: next })
                }}
                onSearch={(next) => {
                  setQuery(next)
                  updateUrl({ q: next || null })
                }}
                variant={scope}
                onUpload={() => setUploadModalOpen(true)}
                onGenerate={() => setAiModalOpen(true)}
                selectAllLabel={
                  scope === "my"
                    ? myVisibleIds.length > 0
                      ? myAllVisibleSelected
                        ? "取消全选"
                        : "全选"
                      : "全选"
                    : undefined
                }
                selectAllDisabled={scope === "my" ? myVisibleIds.length <= 0 || storyDeleting : undefined}
                onSelectAll={scope === "my" ? toggleSelectAllMyVisible : undefined}
                deleteLabel={
                  scope === "my"
                    ? selectedIds.size > 0
                      ? mySelectedCounts.tvcCount > 0 && mySelectedCounts.standardCount > 0
                        ? `删除内容（${selectedIds.size}）`
                        : mySelectedCounts.tvcCount > 0
                          ? `删除项目（${selectedIds.size}）`
                          : `删除剧本（${selectedIds.size}）`
                      : myType === "tvc"
                        ? "删除项目"
                        : "删除剧本"
                    : scope === "library"
                      ? selectedIds.size > 0
                        ? `删除素材（${selectedIds.size}）`
                        : "删除素材"
                      : undefined
                }
                deleteDisabled={
                  scope === "my"
                    ? selectedIds.size <= 0 || storyDeleting
                    : scope === "library"
                      ? selectedIds.size <= 0 || bulkDeleting
                      : undefined
                }
                onDelete={scope === "my" ? openMyStoriesDeleteConfirm : scope === "library" ? openPublicBulkDeleteConfirm : undefined}
              />
            </div>

            <div className={styles.bodyRow}>
              {scope === "library" || scope === "shared" ? (
                <CategorySidebar
                  value={category}
                  onChange={(next) => {
                    setCategory(next)
                    updateUrl({ category: next })
                  }}
                  categories={categories}
                  counts={counts}
                />
              ) : null}

              <div className={styles.contentInner}>
                <div className={styles.gridWrap} ref={gridWrapRef}>
                  {scope === "my" ? (
                    <MyStoriesGroupedGrid
                      items={myFilteredItems}
                      view={view}
                      onItemClick={(item) => handleItemClick(item)}
                      onViewContent={(item) => setStoryContentItem({ id: item.id, title: item.title })}
                      selectedIds={selectedIds}
                      onToggleSelected={toggleSelected}
                      onCreateTvc={() => router.push("/tvc")}
                      showStandard={myType === "standard"}
                      showTvc={myType === "tvc"}
                    />
                  ) : (
                    <LibraryGrid
                      items={displayItems}
                      view={view}
                      onItemClick={(item) => setPreviewItem(item)}
                      selectedIds={selectedIds}
                      onToggleSelected={toggleSelected}
                    />
                  )}
                  {scope === "library" || scope === "shared" ? (
                    <div ref={loadMoreSentinelRef} className={styles.loadMoreSentinel} aria-hidden />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UploadResourceModal
        open={scope === "library" && uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={async (formData, opts) => {
          const file = formData.get("file")
          const type = formData.get("type")
          const name = formData.get("name")
          const description = formData.get("description")
          const tags = formData.get("tags")
          const applicableScenes = formData.get("applicableScenes")
          const durationMsRaw = formData.get("durationMs")
          const durationMsNum =
            typeof durationMsRaw === "string" && Number.isFinite(Number(durationMsRaw)) && Number(durationMsRaw) > 0 ? Math.round(Number(durationMsRaw)) : undefined

          const isLarge = file instanceof File && file.size > 8 * 1024 * 1024
          const canChunk = file instanceof File && typeof type === "string" && type.trim()
          if (isLarge && canChunk) {
            let aborted = false
            let currentAbort: (() => void) | null = null
            let uploadId: string | null = null

            const abortAll = () => {
              aborted = true
              currentAbort?.()
              if (uploadId) {
                void fetch("/api/library/public-resources/upload-abort", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ uploadId })
                })
              }
            }
            opts?.onAbort?.(abortAll)

            const initRes = await fetch("/api/library/public-resources/upload-init", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                type,
                fileName: file.name,
                contentType: file.type || "application/octet-stream",
                size: file.size,
                ...(durationMsNum !== undefined ? { durationMs: durationMsNum } : {}),
                name: typeof name === "string" ? name : undefined,
                description: typeof description === "string" ? description : undefined,
                tags: typeof tags === "string" ? tags : undefined,
                applicableScenes: typeof applicableScenes === "string" ? applicableScenes : undefined
              })
            })
            const initJson = (await initRes.json().catch(() => null)) as any
            if (!initRes.ok || !initJson?.ok) throw new Error(initJson?.error?.message ?? `初始化上传失败（${initRes.status}）`)

            uploadId = String(initJson.data?.uploadId ?? "")
            const chunkSize = Number(initJson.data?.chunkSize ?? 0)
            const totalChunks = Number(initJson.data?.totalChunks ?? 0)
            if (!uploadId || !chunkSize || !totalChunks) throw new Error("初始化上传失败：参数缺失")

            for (let i = 0; i < totalChunks; i++) {
              if (aborted) throw new Error("上传已取消")
              const start = i * chunkSize
              const end = Math.min(file.size, start + chunkSize)
              const blob = file.slice(start, end)
              const { promise, abort } = putBlobWithProgress({
                url: `/api/library/public-resources/upload-chunk?uploadId=${encodeURIComponent(uploadId)}&index=${i}`,
                blob,
                onProgress: (p) => {
                  const loadedOverall = start + p.loaded
                  const percent = file.size > 0 ? Math.round((loadedOverall / file.size) * 100) : null
                  opts?.onProgress?.({ loaded: loadedOverall, total: file.size, percent })
                }
              })
              currentAbort = abort
              const { status, json } = await promise
              const anyJson = json as any
              if (!anyJson?.ok) throw new Error(anyJson?.error?.message ?? `上传分片失败（${status}）`)
              opts?.onProgress?.({ loaded: end, total: file.size, percent: Math.round((end / file.size) * 100) })
            }

            const doneRes = await fetch("/api/library/public-resources/upload-complete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ uploadId })
            })
            const doneJson = (await doneRes.json().catch(() => null)) as any
            if (!doneRes.ok || !doneJson?.ok) throw new Error(doneJson?.error?.message ?? `完成上传失败（${doneRes.status}）`)
            await refreshPublicData()
            return
          }

          const { promise, abort } = postFormDataWithProgress({
            url: "/api/library/public-resources/upload",
            formData,
            onProgress: opts?.onProgress
          })
          opts?.onAbort?.(abort)
          const { status, json } = await promise
          const anyJson = json as any
          if (!anyJson?.ok) throw new Error(anyJson?.error?.message ?? `上传失败（${status}）`)
          await refreshPublicData()
        }}
      />

      <AiGenerateResourceModal
        open={scope === "library" && aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGenerate={async (input) => {
          const res = await aiGeneratePublicResource({
            type: mapAiTypeToDbType(input.type),
            prompt: input.prompt,
            name: input.name,
            description: input.description,
            tags: input.tags,
            applicableScenes: input.applicableScenes
          })
          if (!res.success) throw new Error(res.message)
          await refreshPublicData()
        }}
      />

      <PublicResourcePreviewModal
        open={(scope === "library" || scope === "shared") && previewItem != null}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
      <BulkActionBar
        selectedCount={scope === "library" || scope === "my" ? selectedIds.size : 0}
        deleting={scope === "library" ? bulkDeleting : scope === "my" ? storyDeleting : false}
        onClear={clearSelected}
        onDelete={scope === "library" ? openPublicBulkDeleteConfirm : scope === "my" ? openMyStoriesDeleteConfirm : undefined}
      />
      <StoryContentModal
        open={scope === "my" && storyContentItem != null}
        storyId={storyContentItem?.id ?? null}
        storyTitle={storyContentItem?.title}
        onClose={() => setStoryContentItem(null)}
      />
      <ConfirmModal
        open={scope === "my" && storyDeleteConfirm != null}
        title={
          (storyDeleteConfirm?.tvcCount ?? 0) > 0 && (storyDeleteConfirm?.standardCount ?? 0) > 0
            ? "删除内容"
            : (storyDeleteConfirm?.tvcCount ?? 0) > 0
              ? "删除项目"
              : "删除剧本"
        }
        message={
          (storyDeleteConfirm?.tvcCount ?? 0) > 0 && (storyDeleteConfirm?.standardCount ?? 0) > 0
            ? `确定删除选中的 ${storyDeleteConfirm?.ids.length ?? 0} 项内容吗？（剧本 ${storyDeleteConfirm?.standardCount ?? 0}，TVC 项目 ${storyDeleteConfirm?.tvcCount ?? 0}）此操作不可恢复。`
            : (storyDeleteConfirm?.tvcCount ?? 0) > 0
              ? `确定删除选中的 ${storyDeleteConfirm?.ids.length ?? 0} 个项目吗？此操作不可恢复。`
              : `确定删除选中的 ${storyDeleteConfirm?.ids.length ?? 0} 个剧本吗？此操作不可恢复。`
        }
        confirming={storyDeleting}
        onCancel={() => setStoryDeleteConfirm(null)}
        onConfirm={() => void confirmMyStoriesDelete()}
      />
      <ConfirmModal
        open={scope === "library" && publicDeleteConfirm != null}
        title="删除素材"
        message={`确定删除选中的 ${publicDeleteConfirm?.ids.length ?? 0} 项素材吗？此操作不可恢复。`}
        confirming={bulkDeleting}
        onCancel={() => setPublicDeleteConfirm(null)}
        onConfirm={() => void confirmPublicBulkDelete()}
      />
    </div>
  )
}
