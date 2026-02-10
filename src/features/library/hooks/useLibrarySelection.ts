import { useState, useCallback, useEffect } from "react"
import { deletePublicResources } from "@/server/actions/library/public"
import type { LibraryItem } from "@/shared/contracts/library/libraryItem"
import type { Scope } from "../components/ScopeTabs"

export function useLibrarySelection(scope: Scope, category: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)

  // Reset selection on scope/category change
  useEffect(() => {
    setSelectedIds(new Set())
    setPreviewItem(null)
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

  const handleBulkDelete = useCallback(async (ids: string[], onSuccess: () => Promise<void>) => {
    if (bulkDeleting) return
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 200)
    if (uniqueIds.length <= 0) return

    setBulkDeleting(true)
    try {
      const res = await deletePublicResources(uniqueIds)
      await onSuccess()
      setSelectedIds(new Set())
      setPreviewItem(null)
      return res.deletedCount ?? 0
    } finally {
      setBulkDeleting(false)
    }
  }, [bulkDeleting])

  return {
    selectedIds,
    setSelectedIds,
    bulkDeleting,
    previewItem,
    setPreviewItem,
    toggleSelected,
    clearSelected,
    handleBulkDelete
  }
}
