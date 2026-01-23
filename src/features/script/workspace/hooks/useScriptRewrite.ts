import { useCallback, useEffect, useRef, useState } from "react"
import type { ApiErr } from "@/shared/api"
import {
  deriveLiveRewriteStreaming,
  normalizeAssistantText,
  type RewriteOutput,
  type RewriteState,
  type ThreadMessage,
  type OutlineItem
} from "../utils"

interface UseScriptRewriteProps {
  storyId: string
  activeOutline: OutlineItem | null | undefined
  persistOutlineDraft: (input: { outlineId: string; title?: string | null; content: string; requirements: string }) => Promise<void>
  setToast: (toast: { type: "error" | "success"; message: string } | null) => void
}

/**
 * Hook for handling script rewrite logic
 */
export function useScriptRewrite({ storyId, activeOutline, persistOutlineDraft, setToast }: UseScriptRewriteProps) {
  const [rewriteRequirements, setRewriteRequirements] = useState("")
  const [rewriteBySeq, setRewriteBySeq] = useState<Record<number, RewriteState>>({})
  const [rewriteMessages, setRewriteMessages] = useState<ThreadMessage[]>([])
  const rewriteAbortRef = useRef<AbortController | null>(null)
  const [previewMode, setPreviewMode] = useState<"original" | "rewrite">("original")
  const threadRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  const activeRewrite = activeOutline ? rewriteBySeq[activeOutline.sequence] : undefined
  const isRewriteStreaming = Boolean(activeOutline && activeRewrite?.status === "streaming")

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = threadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    scrollThreadToBottom("smooth")
  }, [rewriteMessages.length, scrollThreadToBottom])

  const handleRewrite = useCallback(async () => {
    if (!activeOutline) return

    const sequence = activeOutline.sequence
    const requirements = rewriteRequirements.trim()

    if (isRewriteStreaming) {
      rewriteAbortRef.current?.abort()
      return
    }

    if (!requirements) return
    setRewriteRequirements("")

    rewriteAbortRef.current?.abort()
    const abortController = new AbortController()
    rewriteAbortRef.current = abortController

    const userId = crypto.randomUUID()
    const notesId = crypto.randomUUID()
    const tipId = crypto.randomUUID()

    setRewriteMessages((prev) => {
      return [
        ...prev,
        { id: userId, role: "user", text: `${requirements}`, outlineSequence: sequence },
        { id: notesId, role: "assistant", text: "", outlineSequence: sequence },
        { id: tipId, role: "assistant", text: "", outlineSequence: sequence }
      ]
    })

    setRewriteBySeq((prev) => {
      return {
        ...prev,
        [sequence]: { status: "streaming", raw: "", requirements }
      }
    })
    setPreviewMode("rewrite")
    scrollThreadToBottom("auto")

    try {
      const res = await fetch("/api/coze/rewrite/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storyId,
          outlineSequence: sequence,
          modification_requirements: requirements
        }),
        signal: abortController.signal
      })

      const contentType = res.headers.get("content-type") ?? ""
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiErr | null
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }

      if (!contentType.includes("text/event-stream") || !res.body) {
        throw new Error("服务端未返回流式响应")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let raw = ""
      let lastFlush = 0
      let pending = ""
      let lastNotesText = ""
      let lastTipText = ""

      const flush = (force: boolean) => {
        const now = performance.now()
        if (!force && now - lastFlush < 80) return
        lastFlush = now
        if (!pending) return

        raw += pending
        pending = ""

        setRewriteBySeq((prev) => {
          const current = prev[sequence]
          if (!current || current.status !== "streaming") return prev
          return { ...prev, [sequence]: { ...current, raw } }
        })

        const live = deriveLiveRewriteStreaming(raw)
        const notesText = live.notes ? normalizeAssistantText(live.notes) : ""
        const tipText = live.tip ? normalizeAssistantText(live.tip) : ""

        if (notesText && notesText !== lastNotesText) {
          lastNotesText = notesText
          setRewriteMessages((prev) => {
            return prev.map((m) => (m.id === notesId ? { ...m, text: notesText } : m))
          })
        }

        if (tipText && tipText !== lastTipText) {
          lastTipText = tipText
          setRewriteMessages((prev) => {
            return prev.map((m) => (m.id === tipId ? { ...m, text: tipText } : m))
          })
        }

        if (shouldAutoScrollRef.current) scrollThreadToBottom("auto")
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        while (true) {
          const idx = buffer.indexOf("\n\n")
          if (idx < 0) break
          const block = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)

          for (const line of block.split("\n")) {
            const trimmed = line.trim()
            if (!trimmed.startsWith("data:")) continue
            const dataPart = trimmed.slice("data:".length).trim()
            if (!dataPart) continue

            let payload: unknown
            try {
              payload = JSON.parse(dataPart)
            } catch {
              continue
            }

            if (!payload || typeof payload !== "object") continue
            const anyPayload = payload as Record<string, unknown>
            if (anyPayload.ok !== true) continue
            const data = anyPayload.data
            if (!data || typeof data !== "object") continue
            const anyData = data as Record<string, unknown>

            if (anyData.type === "delta") {
              const text = typeof anyData.text === "string" ? anyData.text : ""
              if (text) {
                pending += text
                flush(false)
              }
            }

            if (anyData.type === "error") {
              const code = typeof anyData.code === "string" ? anyData.code : "COZE_ERROR"
              const message = typeof anyData.message === "string" ? anyData.message : "改写失败"
              throw new Error(`${code}: ${message}`)
            }

            if (anyData.type === "result") {
              flush(true)
              const result = anyData.result as RewriteOutput | undefined
              if (!result) throw new Error("COZE_RESPONSE_INVALID: 改写结果为空")

              setRewriteBySeq((prev) => {
                return {
                  ...prev,
                  [sequence]: {
                    status: "done",
                    raw,
                    requirements,
                    result
                  }
                }
              })

              setRewriteMessages((prev) => {
                const notesText = normalizeAssistantText(result.rewrite_notes)
                const tipText = normalizeAssistantText(result.friendly_tip)
                return prev.map((m) => {
                  if (m.id === notesId) return { ...m, text: notesText }
                  if (m.id === tipId) return { ...m, text: tipText }
                  return m
                })
              })
              void (async () => {
                try {
                  await persistOutlineDraft({
                    outlineId: activeOutline.outlineId,
                    title: result.new_title ?? null,
                    content: result.new_content,
                    requirements
                  })
                  setToast({ type: "success", message: "已保存为新版本" })
                } catch (e) {
                  const anyErr = e as { message?: string }
                  setToast({ type: "error", message: anyErr?.message ?? "保存版本失败" })
                }
              })()
              scrollThreadToBottom("smooth")
            }
          }
        }
      }
    } catch (err) {
      const anyErr = err as { message?: string }
      const message = anyErr?.message ?? "改写失败，请稍后重试"
      setRewriteBySeq((prev) => {
        const current = prev[sequence]
        const raw = current?.raw ?? ""
        return { ...prev, [sequence]: { status: "error", raw, requirements, error: message } }
      })
      setRewriteMessages((prev) => {
        return [...prev, { id: crypto.randomUUID(), role: "assistant", text: message, outlineSequence: sequence }]
      })
      scrollThreadToBottom("smooth")
    } finally {
      if (rewriteAbortRef.current === abortController) rewriteAbortRef.current = null
    }
  }, [activeOutline, isRewriteStreaming, persistOutlineDraft, rewriteRequirements, scrollThreadToBottom, storyId, setToast])

  return {
    rewriteRequirements,
    setRewriteRequirements,
    rewriteBySeq,
    rewriteMessages,
    previewMode,
    setPreviewMode,
    handleRewrite,
    isRewriteStreaming,
    activeRewrite,
    threadRef,
    shouldAutoScrollRef
  }
}
