import { useCallback } from "react"
import type { StoryboardItem } from "../types"

type UseStoryboardActionsProps = {
  items: StoryboardItem[]
  setItems: React.Dispatch<React.SetStateAction<StoryboardItem[]>>
  updateItemById: (id: string, updater: (item: StoryboardItem) => StoryboardItem) => void
  selectedItems: Set<string>
  setSelectedItems: React.Dispatch<React.SetStateAction<Set<string>>>
  activeEpisode?: string
  reloadShots?: (targetOutlineId?: string) => Promise<void>
  requestConfirm?: (params: { title: string; message: string; confirmText?: string; cancelText?: string }) => Promise<boolean>
  notifyError?: (message: string) => void
}

export function useStoryboardActions({
  items,
  setItems,
  updateItemById,
  selectedItems,
  setSelectedItems,
  activeEpisode,
  reloadShots,
  requestConfirm,
  notifyError
}: UseStoryboardActionsProps) {
  const handleAddRole = useCallback((itemId: string, roleName: string) => {
    updateItemById(itemId, (it) => {
      const exists = it.shot_content.roles.some((r) => r.role_name === roleName)
      if (exists) return it
      return {
        ...it,
        shot_content: {
          ...it.shot_content,
          roles: [
            ...it.shot_content.roles,
            {
              role_name: roleName,
              appearance_time_point: 0,
              location_info: "",
              action: "",
              expression: "",
              speak: null
            }
          ]
        }
      }
    })
  }, [updateItemById])

  const handleRemoveRole = useCallback((itemId: string, roleName: string) => {
    updateItemById(itemId, (it) => ({
      ...it,
      shot_content: {
        ...it.shot_content,
        roles: it.shot_content.roles.filter((r) => r.role_name !== roleName)
      }
    }))
  }, [updateItemById])

  const handleAddItem = useCallback((itemId: string, targetKey: "role_items" | "other_items", name: string) => {
    updateItemById(itemId, (it) => {
      const currentList = it.shot_content[targetKey]
      if (currentList.includes(name)) return it
      return {
        ...it,
        shot_content: {
          ...it.shot_content,
          [targetKey]: [...currentList, name]
        }
      }
    })
  }, [updateItemById])

  const handleRemoveItem = useCallback((itemId: string, target: "role_items" | "other_items", name: string) => {
    updateItemById(itemId, (it) => ({
      ...it,
      shot_content: {
        ...it.shot_content,
        [target]: it.shot_content[target].filter((n) => n !== name)
      }
    }))
  }, [updateItemById])

  const deleteFromServer = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/video/storyboards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardIds: ids })
      })
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    },
    []
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = requestConfirm
        ? await requestConfirm({ title: "删除分镜", message: "确定要删除这个分镜吗？\n此操作不可恢复。", confirmText: "删除", cancelText: "取消" })
        : await Promise.resolve((window.confirm("确定要删除这个分镜吗？") as unknown) as boolean)
      if (!ok) return
      try {
        await deleteFromServer([id])
        if (reloadShots) await reloadShots(activeEpisode)
        else setItems((prev) => prev.filter((i) => i.id !== id))
        setSelectedItems((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (e) {
        const anyErr = e as { message?: string }
        const msg = anyErr?.message ?? "删除失败"
        if (notifyError) notifyError(msg)
        else alert(msg)
      }
    },
    [activeEpisode, deleteFromServer, notifyError, reloadShots, requestConfirm, setItems, setSelectedItems]
  )

  const handleBatchDelete = useCallback(async () => {
    if (selectedItems.size === 0) return
    const ok = requestConfirm
      ? await requestConfirm({
          title: "删除分镜",
          message: `确定要删除选中的 ${selectedItems.size} 个分镜吗？\n此操作不可恢复。`,
          confirmText: "删除",
          cancelText: "取消"
        })
      : await Promise.resolve((window.confirm(`确定要删除选中的 ${selectedItems.size} 个分镜吗？`) as unknown) as boolean)
    if (!ok) return
    const ids = Array.from(selectedItems)
    try {
      await deleteFromServer(ids)
      if (reloadShots) await reloadShots(activeEpisode)
      else setItems((prev) => prev.filter((i) => !selectedItems.has(i.id)))
      setSelectedItems(new Set())
    } catch (e) {
      const anyErr = e as { message?: string }
      const msg = anyErr?.message ?? "删除失败"
      if (notifyError) notifyError(msg)
      else alert(msg)
    }
  }, [activeEpisode, deleteFromServer, notifyError, reloadShots, requestConfirm, selectedItems, setItems, setSelectedItems])

  const toggleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(items.map((i) => i.id)))
    }
  }, [items, selectedItems, setSelectedItems])

  const toggleSelect = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }, [setSelectedItems])

  return {
    handleAddRole,
    handleRemoveRole,
    handleAddItem,
    handleRemoveItem,
    handleDelete,
    handleBatchDelete,
    toggleSelectAll,
    toggleSelect
  }
}
