import { useCallback, useEffect, useRef } from "react"

export function useTvcChatPersist(projectId?: string | null): {
  reset: () => void
  enqueue: (patch: { messages?: Array<{ role: "user" | "assistant"; content: string }> }) => void
  markUserMessageOnce: (text: string) => boolean
  markAssistantMessageOnce: (text: string) => boolean
} {
  const savedUserTextRef = useRef<Set<string>>(new Set())
  const savedAssistantTextRef = useRef<Set<string>>(new Set())
  const pendingPersistRef = useRef<{
    messages: Array<{ role: "user" | "assistant"; content: string }>
  }>({ messages: [] })
  const persistTimerRef = useRef<number | null>(null)

  const enqueue = useCallback(
    (patch: {
      messages?: Array<{ role: "user" | "assistant"; content: string }>
    }) => {
      if (!projectId) return
      const p = pendingPersistRef.current
      if (patch.messages?.length) p.messages.push(...patch.messages)
      if (persistTimerRef.current) return
      persistTimerRef.current = window.setTimeout(async () => {
        persistTimerRef.current = null
        const now = pendingPersistRef.current
        pendingPersistRef.current = { messages: [] }
        if (now.messages.length === 0) return
        await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/creation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(now)
        }).catch(() => null)
      }, 300)
    },
    [projectId]
  )

  const reset = useCallback(() => {
    savedUserTextRef.current = new Set()
    savedAssistantTextRef.current = new Set()
    pendingPersistRef.current = { messages: [] }
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    reset()
  }, [projectId, reset])

  const markUserMessageOnce = useCallback((text: string): boolean => {
    if (savedUserTextRef.current.has(text)) return false
    savedUserTextRef.current.add(text)
    return true
  }, [])

  const markAssistantMessageOnce = useCallback((text: string): boolean => {
    if (savedAssistantTextRef.current.has(text)) return false
    savedAssistantTextRef.current.add(text)
    return true
  }, [])

  return { reset, enqueue, markUserMessageOnce, markAssistantMessageOnce }
}
