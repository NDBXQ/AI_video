"use client"

import { useCallback, useRef, useState } from "react"
import type { ChatMessage } from "@/features/tvc/types"
import { parseActionsFromText, parseAgentBlocks, parseResponseXml } from "@/features/tvc/agent/parseAgentBlocks"
import { formatAgentError } from "./errors"
import { createSseDecoder } from "./sse"
import { stripTvcAssistantEnvelope } from "./xmlUtils"

export function useTvcChatStream(params: {
  projectId?: string | null
  onAgentTask?: (task: {
    id: string
    kind: "reference_image" | "first_frame" | "video_clip"
    state: "queued" | "running" | "done" | "failed"
    targetOrdinal?: number
    targetOrdinals?: number[]
    producedCount?: number
    message?: string
  }) => void
  onCheckpoint?: (c: { name: string; detail?: Record<string, unknown> }) => void
  onClarification?: (e: { phase: "delta" | "done"; markdown: string }) => void
  onScript?: (e: { phase: "delta" | "done"; markdown: string }) => void
  onUserMessage?: (text: string) => void
  enqueuePersist: (patch: { messages?: Array<{ role: "user" | "assistant"; content: string }> }) => void
  markAssistantMessageOnce: (text: string) => boolean
}): {
  streaming: boolean
  statusText: string
  quickActions: string[]
  abort: () => void
  start: (args: {
    prompt: string
    userTextForCallback: string
    assistantId: string
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
    scrollToBottom: () => void
  }) => Promise<void>
  reset: () => void
} {
  const { projectId, onAgentTask, onCheckpoint, onClarification, onScript, onUserMessage, enqueuePersist, markAssistantMessageOnce } = params

  const abortRef = useRef<AbortController | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [quickActions, setQuickActions] = useState<string[]>([])

  const lastSavedAssistantTextRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    lastSavedAssistantTextRef.current = null
    setQuickActions([])
    setStatusText("")
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const start = useCallback(
    async (args: {
      prompt: string
      userTextForCallback: string
      assistantId: string
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
      scrollToBottom: () => void
    }) => {
      const trimmedPrompt = args.prompt.trim()
      if (!trimmedPrompt) return
      if (streaming) {
        abortRef.current?.abort()
        return
      }
      setQuickActions([])
      onUserMessage?.(String(args.userTextForCallback ?? "").trim())

      abortRef.current?.abort()
      const abortController = new AbortController()
      abortRef.current = abortController
      setStreaming(true)
      setStatusText("")

      try {
        const res = await fetch("/api/tvc/agent/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: trimmedPrompt, projectId }),
          signal: abortController.signal
        })

        const contentType = res.headers.get("content-type") ?? ""
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
        }

        if (!contentType.includes("text/event-stream") || !res.body) {
          throw new Error("服务端未返回流式响应")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let raw = ""
        let pending = ""
        let lastFlush = 0
        let lastParseAt = 0
        let currentBlocks: ChatMessage["blocks"] = []
        const sse = createSseDecoder()

        const flush = (force: boolean) => {
          const now = performance.now()
          if (!force && now - lastFlush < 30) return
          lastFlush = now
          if (!pending) return
          raw += pending
          pending = ""
          const shouldParse = force || now - lastParseAt > 240
          if (shouldParse) {
            lastParseAt = now
            const allBlocks = parseAgentBlocks(raw)
            currentBlocks = allBlocks.filter((b) => b.kind !== "text")

            const assistantXml = currentBlocks.filter((b) => b.kind === "response").slice(-1)[0]?.raw ?? null
            const parsed = assistantXml ? parseResponseXml(assistantXml) : null
            const nextActions = (parsed?.actions ?? [])
              .map((a) => a.command)
              .filter((c) => c && c !== "修改")
            setQuickActions(nextActions)
          }
          args.setMessages((prev) => prev.map((m) => (m.id === args.assistantId ? { ...m, text: raw, blocks: currentBlocks } : m)))
          requestAnimationFrame(() => args.scrollToBottom())
        }

        const handlePayload = (payload: unknown) => {
          if (!payload || typeof payload !== "object") return
          const anyPayload = payload as Record<string, unknown>

          if (anyPayload.ok === false) {
            const err = (anyPayload.error ?? {}) as Record<string, unknown>
            const msg = typeof err.message === "string" ? err.message : "执行失败"
            const code = typeof err.code === "string" ? err.code : ""
            throw new Error(code ? `${msg} (${code})` : msg)
          }

          if (anyPayload.ok !== true) return
          const data = anyPayload.data
          if (!data || typeof data !== "object") return
          const anyData = data as Record<string, unknown>

          if (anyData.type === "delta") {
            const t = typeof anyData.text === "string" ? anyData.text : ""
            if (t) {
              pending += t
              flush(false)
            }
            return
          }

          if (anyData.type === "status") {
            const t = typeof anyData.text === "string" ? anyData.text : ""
            setStatusText(t)
            return
          }

          if (anyData.type === "checkpoint") {
            const name = typeof anyData.name === "string" ? anyData.name : ""
            const detail = typeof anyData.detail === "object" && anyData.detail ? (anyData.detail as Record<string, unknown>) : undefined
            if (name) onCheckpoint?.({ name, ...(detail ? { detail } : {}) })
            return
          }

          if (anyData.type === "clarification") {
            const phase = anyData.phase === "delta" || anyData.phase === "done" ? (anyData.phase as any) : ""
            const markdown = typeof anyData.markdown === "string" ? anyData.markdown : ""
            if (phase && markdown) onClarification?.({ phase, markdown })
            return
          }

          if (anyData.type === "script") {
            const phase = anyData.phase === "delta" || anyData.phase === "done" ? (anyData.phase as any) : ""
            const markdown = typeof anyData.markdown === "string" ? anyData.markdown : ""
            if (phase && markdown) onScript?.({ phase, markdown })
            return
          }

          if (anyData.type === "task") {
            const id = typeof anyData.id === "string" ? anyData.id : ""
            const kind =
              anyData.kind === "reference_image" || anyData.kind === "first_frame" || anyData.kind === "video_clip" ? (anyData.kind as any) : ""
            const state = anyData.state === "queued" || anyData.state === "running" || anyData.state === "done" || anyData.state === "failed" ? (anyData.state as any) : ""
            const targetOrdinal = typeof anyData.targetOrdinal === "number" && Number.isFinite(anyData.targetOrdinal) ? Math.trunc(anyData.targetOrdinal) : undefined
            const targetOrdinals = Array.isArray(anyData.targetOrdinals)
              ? (anyData.targetOrdinals as any[]).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.trunc(n))
              : undefined
            const producedCount = typeof anyData.producedCount === "number" && Number.isFinite(anyData.producedCount) ? Math.trunc(anyData.producedCount) : undefined
            const message = typeof anyData.message === "string" ? anyData.message : undefined
            if (id && kind && state) {
              onAgentTask?.({ id, kind, state, ...(targetOrdinal ? { targetOrdinal } : {}), ...(targetOrdinals?.length ? { targetOrdinals } : {}), ...(typeof producedCount === "number" ? { producedCount } : {}), ...(message ? { message } : {}) })
            }
            return
          }

          if (anyData.type === "error") {
            const msg = typeof anyData.message === "string" ? anyData.message : "执行失败"
            const code = typeof anyData.code === "string" ? anyData.code : ""
            throw new Error(code ? `${msg} (${code})` : msg)
          }

          if (anyData.type === "result") {
            flush(true)
            setStatusText("")
            const finalRaw = typeof anyData.raw === "string" ? anyData.raw : raw
            const allBlocks = parseAgentBlocks(finalRaw)
            const blocks = allBlocks.filter((b) => b.kind !== "text")

            const assistantXml = blocks.filter((b) => b.kind === "response").slice(-1)[0]?.raw ?? null
            const parsed = assistantXml ? parseResponseXml(assistantXml) : null
            const displayText = stripTvcAssistantEnvelope(finalRaw)
            const nextActions = (displayText ? parseActionsFromText(displayText) : parsed?.actions ?? []).map((a) => a.command).filter((c) => c && c !== "修改")
            setQuickActions(nextActions)
            const persistText = displayText
            if (persistText && lastSavedAssistantTextRef.current !== persistText && markAssistantMessageOnce(persistText)) {
              lastSavedAssistantTextRef.current = persistText
              enqueuePersist({ messages: [{ role: "assistant", content: persistText }] })
            }
            args.setMessages((prev) => prev.map((m) => (m.id === args.assistantId ? { ...m, text: finalRaw, blocks } : m)))
            requestAnimationFrame(() => args.scrollToBottom())
          }
        }

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const messages = sse.push(chunk)
          for (const m of messages) {
            if (!m.data) continue
            let payload: unknown
            try {
              payload = JSON.parse(m.data)
            } catch {
              continue
            }
            handlePayload(payload)
          }
        }
        for (const m of sse.flush()) {
          if (!m.data) continue
          let payload: unknown
          try {
            payload = JSON.parse(m.data)
          } catch {
            continue
          }
          handlePayload(payload)
        }
      } catch (err) {
        const anyErr = err as { name?: string; message?: string }
        const t = formatAgentError(anyErr?.name === "AbortError" ? "操作已取消" : anyErr?.message ?? "执行失败")
        const blocks = parseAgentBlocks(t).filter((b) => b.kind !== "text")
        const persistText = stripTvcAssistantEnvelope(t) || String(t ?? "").trim()
        if (persistText && lastSavedAssistantTextRef.current !== persistText && markAssistantMessageOnce(persistText)) {
          lastSavedAssistantTextRef.current = persistText
          enqueuePersist({ messages: [{ role: "assistant", content: persistText }] })
        }
        args.setMessages((prev) => prev.map((m) => (m.id === args.assistantId ? { ...m, text: t, blocks } : m)))
      } finally {
        setStreaming(false)
        setStatusText("")
      }
    },
    [enqueuePersist, markAssistantMessageOnce, onAgentTask, onCheckpoint, onClarification, onScript, onUserMessage, projectId, streaming]
  )

  return { streaming, statusText, quickActions, abort, start, reset }
}
