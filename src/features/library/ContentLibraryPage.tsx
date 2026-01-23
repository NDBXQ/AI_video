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

  const handleMyStoriesDelete = useCallback(async () => {
    if (selectedIds.size <= 0) return
    const ok = window.confirm(`确定删除选中的 ${selectedIds.size} 个剧本吗？`)
    if (!ok) return
    for (const id of Array.from(selectedIds)) {
      await deleteStory(id)
    }
    await loadMyStories(query)
    clearSelected()
  }, [selectedIds, loadMyStories, query, clearSelected])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
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

      <div className={styles.main}>
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

        <div className={styles.content}>
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
            deleteDisabled={scope === "my" ? selectedIds.size <= 0 : undefined}
            onDelete={scope === "my" ? handleMyStoriesDelete : undefined}
          />

          <div className={styles.contentHeader}>
            {loading ? "加载中..." : `结果 ${displayItems.length}`}
          </div>

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
        onDelete={() => handleBulkDelete(refreshPublicData)}
      />
      <StoryOriginalContentModal open={scope === "my" && originalStoryId != null} storyId={originalStoryId} onClose={() => setOriginalStoryId(null)} />
    </div>
  )
}
