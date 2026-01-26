"use client"

import type { ReactElement } from "react"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { ScopeTabs } from "./components/ScopeTabs"
import { CategorySidebar } from "./components/CategorySidebar"
import { LibraryToolbar } from "./components/LibraryToolbar"
import { LibraryGrid } from "./components/LibraryGrid"
import { UploadResourceModal } from "./components/UploadResourceModal"
import { AiGenerateResourceModal } from "./components/AiGenerateResourceModal"
import { BulkActionBar } from "./components/BulkActionBar"
import { PublicResourcePreviewModal } from "./components/PublicResourcePreviewModal"
import { StoryOriginalContentModal } from "./components/StoryOriginalContentModal"
import { ConfirmModal } from "./components/ConfirmModal"
import { deleteStory } from "./actions/library"
import { uploadPublicResource } from "./actions/upload"
import { aiGeneratePublicResource } from "./actions/ai-generate"
import type { LibraryItem } from "./components/LibraryCard"
import styles from "./ContentLibraryPage.module.css"
import { useLibraryData } from "./hooks/useLibraryData"
import { useLibrarySelection } from "./hooks/useLibrarySelection"
import { mapAiTypeToDbType } from "./utils/libraryUtils"

export function ContentLibraryPage(): ReactElement {
  const router = useRouter()
  
  const {
    scope, setScope,
    category, setCategory,
    view, setView,
    query, setQuery,
    updateUrl,
    displayItems,
    counts,
    categories,
    loading,
    refreshPublicData,
    loadMyStories
  } = useLibraryData()

  const {
    selectedIds,
    toggleSelected,
    clearSelected,
    previewItem,
    setPreviewItem,
    originalStoryId,
    setOriginalStoryId,
    bulkDeleting,
    handleBulkDelete
  } = useLibrarySelection(scope, category)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [storyDeleteConfirm, setStoryDeleteConfirm] = useState<{ ids: string[] } | null>(null)
  const [storyDeleting, setStoryDeleting] = useState(false)
  const [publicDeleteConfirm, setPublicDeleteConfirm] = useState<{ ids: string[] } | null>(null)

  const handleItemClick = useCallback(
    (item: LibraryItem) => {
      if (scope !== "my") return
      const stage = item.progressStage ?? "outline"
      if (stage === "outline") {
        router.push(`/script/workspace/${item.id}`)
        return
      }
      router.push(`/video?storyId=${item.id}&tab=list`)
    },
    [router, scope]
  )

  const openMyStoriesDeleteConfirm = useCallback(() => {
    if (selectedIds.size <= 0) return
    setStoryDeleteConfirm({ ids: Array.from(selectedIds) })
  }, [selectedIds])

  const confirmMyStoriesDelete = useCallback(async () => {
    const ids = storyDeleteConfirm?.ids ?? []
    if (ids.length <= 0 || storyDeleting) return
    setStoryDeleting(true)
    try {
      for (const id of ids) {
        await deleteStory(id)
      }
      await loadMyStories(query)
      clearSelected()
      setStoryDeleteConfirm(null)
    } finally {
      setStoryDeleting(false)
    }
  }, [clearSelected, loadMyStories, query, storyDeleteConfirm, storyDeleting])

  const openPublicBulkDeleteConfirm = useCallback(() => {
    if (scope !== "public") return
    if (selectedIds.size <= 0) return
    setPublicDeleteConfirm({ ids: Array.from(selectedIds) })
  }, [scope, selectedIds])

  const confirmPublicBulkDelete = useCallback(async () => {
    const ids = publicDeleteConfirm?.ids ?? []
    if (ids.length <= 0) return
    await handleBulkDelete(ids, refreshPublicData)
    setPublicDeleteConfirm(null)
  }, [handleBulkDelete, publicDeleteConfirm, refreshPublicData])

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.contentWrap}>
            <div className={styles.topRow}>
              <div className={styles.scopeWrap}>
                <ScopeTabs
                  value={scope}
                  onChange={(next) => {
                    setScope(next)
                    const nextCategory = next === "public" ? "all" : "draft"
                    setCategory(nextCategory)
                    updateUrl({ scope: next, category: nextCategory })
                  }}
                />
              </div>

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
                deleteLabel={scope === "my" ? (selectedIds.size > 0 ? `删除剧本（${selectedIds.size}）` : "删除剧本") : undefined}
                deleteDisabled={scope === "my" ? selectedIds.size <= 0 || storyDeleting : undefined}
                onDelete={scope === "my" ? openMyStoriesDeleteConfirm : undefined}
              />
            </div>

            <div className={styles.bodyRow}>
              {scope === "public" ? (
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
                <div className={styles.gridWrap}>
                  <LibraryGrid
                    items={displayItems}
                    view={view}
                    onItemClick={(item) => {
                      if (scope === "public") {
                        setPreviewItem(item)
                        return
                      }
                      handleItemClick(item)
                    }}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    onViewOriginal={(item) => {
                      if (scope !== "my") return
                      if (item.type !== "storyboard") return
                      setOriginalStoryId(item.id)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UploadResourceModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={async (formData) => {
          const res = await uploadPublicResource(formData)
          if (!res.success) throw new Error(res.message)
          if (scope === "my") {
            await loadMyStories(query)
            return
          }
          await refreshPublicData()
        }}
      />

      <AiGenerateResourceModal
        open={scope === "public" && aiModalOpen}
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

      <PublicResourcePreviewModal open={scope === "public" && previewItem != null} item={previewItem} onClose={() => setPreviewItem(null)} />
      <BulkActionBar
        selectedCount={scope === "public" ? selectedIds.size : 0}
        deleting={bulkDeleting}
        onClear={clearSelected}
        onDelete={openPublicBulkDeleteConfirm}
      />
      <StoryOriginalContentModal open={scope === "my" && originalStoryId != null} storyId={originalStoryId} onClose={() => setOriginalStoryId(null)} />
      <ConfirmModal
        open={scope === "my" && storyDeleteConfirm != null}
        title="删除剧本"
        message={`确定删除选中的 ${storyDeleteConfirm?.ids.length ?? 0} 个剧本吗？此操作不可恢复。`}
        confirming={storyDeleting}
        onCancel={() => setStoryDeleteConfirm(null)}
        onConfirm={() => void confirmMyStoriesDelete()}
      />
      <ConfirmModal
        open={scope === "public" && publicDeleteConfirm != null}
        title="删除公共资源"
        message={`确定删除选中的 ${publicDeleteConfirm?.ids.length ?? 0} 项公共资源吗？此操作不可恢复。`}
        confirming={bulkDeleting}
        onCancel={() => setPublicDeleteConfirm(null)}
        onConfirm={() => void confirmPublicBulkDelete()}
      />
    </div>
  )
}
