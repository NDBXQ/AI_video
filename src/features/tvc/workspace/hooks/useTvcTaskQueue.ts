"use client"

import { useCallback, useMemo, useState } from "react"

export type TvcAssetKind = "reference_image" | "first_frame" | "video_clip"

export type TvcUiTask = {
  id: string
  kind: TvcAssetKind
  title: string
  status: "queued" | "running" | "done" | "failed"
  createdAt: number
  baselineCount?: number
  targetOrdinal?: number
  baselineValue?: string
  message?: string
}

export function useTvcTaskQueue(params: {
  assetUrlByKey: Record<string, string>
  resetClarification: () => void
}): {
  taskQueue: TvcUiTask[]
  onAgentTask: (task: {
    id: string
    kind: TvcAssetKind
    state: "queued" | "running" | "done" | "failed"
    targetOrdinal?: number
    targetOrdinals?: number[]
    producedCount?: number
    message?: string
  }) => void
  externalSend: { id: string; text: string } | null
  externalDraft: { id: string; text: string } | null
  requestChatSend: (args: { text: string; kind?: TvcAssetKind; targetOrdinal?: number }) => void
  requestChatDraft: (text: string) => void
} {
  const { assetUrlByKey, resetClarification } = params
  const [taskQueueBase, setTaskQueueBase] = useState<TvcUiTask[]>([])
  const [externalSend, setExternalSend] = useState<{ id: string; text: string } | null>(null)
  const [externalDraft, setExternalDraft] = useState<{ id: string; text: string } | null>(null)

  const assetCounts = useMemo(() => {
    const counts: Record<TvcAssetKind, number> = { reference_image: 0, first_frame: 0, video_clip: 0 }
    for (const key of Object.keys(assetUrlByKey)) {
      if (key.endsWith(":orig")) continue
      const m = /^(reference_image|first_frame|video_clip):(\d+)$/.exec(key)
      if (!m) continue
      const kind = m[1] as TvcAssetKind
      const ordinal = Number(m[2])
      if (!Number.isFinite(ordinal) || ordinal <= 0) continue
      counts[kind] = Math.max(counts[kind], ordinal)
    }
    return counts
  }, [assetUrlByKey])

  const taskQueue = useMemo(() => {
    return taskQueueBase.map((t) => {
      if (t.status !== "queued" && t.status !== "running") return t
      if (t.targetOrdinal && t.kind) {
        const key = `${t.kind}:${t.targetOrdinal}:orig`
        const value = String(assetUrlByKey[key] ?? assetUrlByKey[`${t.kind}:${t.targetOrdinal}`] ?? "").trim()
        if (value && value !== String(t.baselineValue ?? "")) return { ...t, status: "done" as const }
        return t
      }
      const baseline = Number(t.baselineCount ?? 0)
      const current = Number(assetCounts[t.kind] ?? 0)
      if (current > baseline) return { ...t, status: "done" as const }
      return t
    })
  }, [assetCounts, assetUrlByKey, taskQueueBase])

  const onAgentTask = useCallback((task: {
    id: string
    kind: TvcAssetKind
    state: "queued" | "running" | "done" | "failed"
    targetOrdinal?: number
    targetOrdinals?: number[]
    producedCount?: number
    message?: string
  }) => {
    const kindLabel = task.kind === "reference_image" ? "参考图" : task.kind === "first_frame" ? "首帧" : "视频片段"
    const ordinalHint =
      typeof task.targetOrdinal === "number" && task.targetOrdinal > 0
        ? task.targetOrdinal
        : Array.isArray(task.targetOrdinals) && task.targetOrdinals.length === 1
          ? task.targetOrdinals[0]
          : undefined
    const status: TvcUiTask["status"] = task.state
    const title =
      status === "failed"
        ? `${kindLabel}${ordinalHint ? ` #${ordinalHint}` : ""} 失败`
        : status === "done"
          ? `${kindLabel}${ordinalHint ? ` #${ordinalHint}` : ""} 完成`
          : `${kindLabel}${ordinalHint ? ` #${ordinalHint}` : ""} 生成`

    setTaskQueueBase((prev) => {
      const match = (t: TvcUiTask) => {
        if (t.kind !== task.kind) return false
        if (typeof ordinalHint === "number") return t.targetOrdinal === ordinalHint
        return !t.targetOrdinal
      }
      const idx = prev.findIndex((t) => match(t) && (t.status === "queued" || t.status === "running"))
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = { ...next[idx], status, ...(task.message ? { message: task.message } : {}), ...(title ? { title } : {}) }
        return next
      }
      return [{ id: task.id, kind: task.kind, title, status, createdAt: Date.now(), ...(ordinalHint ? { targetOrdinal: ordinalHint } : {}), ...(task.message ? { message: task.message } : {}) }, ...prev].slice(0, 8)
    })
  }, [])

  const requestChatSend = useCallback(
    (args: { text: string; kind?: TvcAssetKind; targetOrdinal?: number }) => {
      const text = args.text.trim()
      if (!text) return
      resetClarification()
      setExternalSend({ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, text })
      const kind = args.kind
      if (kind) {
        const kindLabel = kind === "reference_image" ? "参考图" : kind === "first_frame" ? "首帧" : "视频片段"
        const title = `${kindLabel}${args.targetOrdinal ? ` #${args.targetOrdinal}` : ""}`
        const baselineValue =
          args.targetOrdinal && (assetUrlByKey[`${kind}:${args.targetOrdinal}:orig`] || assetUrlByKey[`${kind}:${args.targetOrdinal}`])
            ? String(assetUrlByKey[`${kind}:${args.targetOrdinal}:orig`] ?? assetUrlByKey[`${kind}:${args.targetOrdinal}`] ?? "").trim()
            : ""
        setTaskQueueBase((prev) => [
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            kind,
            title: `${title} 生成`,
            status: "queued" as const,
            createdAt: Date.now(),
            ...(args.targetOrdinal ? { targetOrdinal: args.targetOrdinal, baselineValue } : { baselineCount: assetCounts[kind] ?? 0 })
          },
          ...prev
        ].slice(0, 8))
      }
    },
    [assetCounts, assetUrlByKey, resetClarification]
  )

  const requestChatDraft = useCallback((text: string) => {
    const trimmed = text.trim()
    setExternalDraft(trimmed ? { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, text: trimmed } : null)
  }, [])

  return { taskQueue, onAgentTask, externalSend, externalDraft, requestChatSend, requestChatDraft }
}
