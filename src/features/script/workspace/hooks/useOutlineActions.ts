import { useCallback, useEffect, useState } from "react"
import type { ApiErr, ApiOk } from "@/shared/api"
import type { OutlineItem } from "../utils"

/**
 * Hook for handling outline actions (delete, save draft)
 * @param {React.Dispatch<React.SetStateAction<ReadonlyArray<OutlineItem>>>} setLocalOutlines - State setter for outlines
 * @returns {Object} Actions and state
 */
export function useOutlineActions(
  setLocalOutlines: React.Dispatch<React.SetStateAction<ReadonlyArray<OutlineItem>>>
) {
  const [deletingOutlineId, setDeletingOutlineId] = useState<string | null>(null)
  const [confirmDeleteOutlineId, setConfirmDeleteOutlineId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!confirmDeleteOutlineId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDeleteOutlineId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [confirmDeleteOutlineId])

  const handleDeleteOutline = useCallback(
    async (outlineId: string) => {
      if (!outlineId || deletingOutlineId) return
      setDeletingOutlineId(outlineId)
      try {
        const res = await fetch(`/api/script/outlines/${encodeURIComponent(outlineId)}`, { method: "DELETE" })
        const json = (await res.json().catch(() => null)) as ApiOk<unknown> | ApiErr | null
        if (!res.ok || !json || (json as ApiErr).ok === false) {
          const errJson = json as ApiErr | null
          throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
        }
        setToast({ type: "success", message: "已删除" })
        window.location.reload()
      } catch (err) {
        const anyErr = err as { message?: string }
        setToast({ type: "error", message: anyErr?.message ?? "删除失败，请稍后重试" })
      } finally {
        setDeletingOutlineId(null)
      }
    },
    [deletingOutlineId]
  )

  const persistOutlineDraft = useCallback(
    async (input: { outlineId: string; title?: string | null; content: string; requirements: string }) => {
      const res = await fetch(`/api/script/outlines/${encodeURIComponent(input.outlineId)}/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: input.title ?? undefined,
          content: input.content,
          requirements: input.requirements
        })
      })
      const json = (await res.json().catch(() => null)) as ApiOk<any> | ApiErr | null
      if (!res.ok || !json || (json as ApiErr).ok === false) {
        const errJson = json as ApiErr | null
        throw new Error(errJson?.error?.message ?? `HTTP ${res.status}`)
      }
      const okJson = json as ApiOk<{ outlineId: string; draft: any; activeDraftId: string }>
      const outlineId = okJson.data.outlineId
      const draft = okJson.data.draft
      const activeDraftId = okJson.data.activeDraftId
      setLocalOutlines((prev) =>
        prev.map((o) =>
          o.outlineId === outlineId
            ? {
                ...o,
                outlineDrafts: [...(Array.isArray(o.outlineDrafts) ? o.outlineDrafts : []), draft],
                activeOutlineDraftId: activeDraftId
              }
            : o
        )
      )
    },
    [setLocalOutlines]
  )

  return {
    deletingOutlineId,
    confirmDeleteOutlineId,
    setConfirmDeleteOutlineId,
    handleDeleteOutline,
    persistOutlineDraft,
    toast,
    setToast
  }
}
