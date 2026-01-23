import { useState, useCallback, useEffect } from "react"
import { deletePublicResources } from "../actions/public"
import type { LibraryItem } from "../components/LibraryCard"
import type { Scope } from "../components/ScopeTabs"

export function useLibrarySelection(scope: Scope, category: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)
  const [originalStoryId, setOriginalStoryId] = useState<string | null>(null)

  // Reset selection on scope/category change
  useEffect(() => {
    setSelectedIds(new Set())
    setPreviewItem(null)
    setOriginalStoryId(null)
  }, [category, scope])

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelected = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkDelete = useCallback(async (onSuccess: () => Promise<void>) => {
    if (selectedIds.size <= 0 || bulkDeleting) return
    const ok = window.confirm(`确定删除已选中的 ${selectedIds.size} 项吗？`)
    if (!ok) return

    setBulkDeleting(true)
    try {
      await deletePublicResources(Array.from(selectedIds))
      await onSuccess()
      setSelectedIds(new Set())
      setPreviewItem(null)
    } finally {
      setBulkDeleting(false)
    }
  }, [bulkDeleting, selectedIds])

  return {
    selectedIds,
    setSelectedIds,
    bulkDeleting,
    previewItem,
    setPreviewItem,
    originalStoryId,
    setOriginalStoryId,
    toggleSelected,
    clearSelected,
    handleBulkDelete
  }
}
