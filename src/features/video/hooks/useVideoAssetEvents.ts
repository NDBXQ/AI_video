import { useEffect, useRef } from "react"

export type VideoStoryboardEvent = { id: string; outlineId: string; status?: string }
export type VideoImageEvent = { id: string; storyboardId: string | null; category: string; name: string; status?: string }

function startPolling(fn: () => void, intervalMs: number): () => void {
  const t = window.setInterval(fn, intervalMs)
  return () => window.clearInterval(t)
}

export function useVideoStoryboardEvents(params: {
  storyId: string
  enabled?: boolean
  onEvent: (ev: VideoStoryboardEvent) => void
  onFallbackTick?: () => void
}) {
  const { storyId, enabled = true, onEvent, onFallbackTick } = params
  const onEventRef = useRef(onEvent)
  const onFallbackTickRef = useRef(onFallbackTick)
  const cursorRef = useRef<string>("")

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onFallbackTickRef.current = onFallbackTick
  }, [onFallbackTick])

  useEffect(() => {
    if (!enabled) return
    if (!storyId) return
    if (typeof window === "undefined") return

    let stopPolling: (() => void) | null = null
    const startFallback = () => {
      if (stopPolling) return
      const tick = onFallbackTickRef.current
      if (!tick) return
      stopPolling = startPolling(tick, 4000)
    }

    if (typeof EventSource === "undefined") {
      startFallback()
      return () => {
        stopPolling?.()
      }
    }

    const u = new URL("/api/video/storyboards/events", window.location.origin)
    u.searchParams.set("storyId", storyId)
    const cursor = cursorRef.current.trim()
    if (cursor) u.searchParams.set("cursor", cursor)

    const es = new EventSource(u.toString())
    const onMessage = (raw: MessageEvent) => {
      const id = String((raw as any)?.lastEventId ?? "").trim()
      if (id) cursorRef.current = id
      try {
        const parsed = JSON.parse(String(raw.data ?? "{}")) as Partial<VideoStoryboardEvent>
        const storyboardId = typeof parsed.id === "string" ? parsed.id.trim() : ""
        const outlineId = typeof parsed.outlineId === "string" ? parsed.outlineId.trim() : ""
        if (!storyboardId || !outlineId) return
        onEventRef.current({ id: storyboardId, outlineId, status: typeof parsed.status === "string" ? parsed.status : undefined })
      } catch {
      }
    }

    es.addEventListener("storyboard", onMessage as any)
    es.onerror = () => {
      es.close()
      startFallback()
    }

    return () => {
      es.close()
      stopPolling?.()
    }
  }, [enabled, storyId])
}

export function useVideoImageEvents(params: {
  storyId: string
  enabled?: boolean
  storyboardId?: string
  includeGlobal?: boolean
  onEvent: (ev: VideoImageEvent) => void
  onFallbackTick?: () => void
}) {
  const { storyId, enabled = true, storyboardId, includeGlobal = true, onEvent, onFallbackTick } = params
  const onEventRef = useRef(onEvent)
  const onFallbackTickRef = useRef(onFallbackTick)
  const cursorRef = useRef<string>("")

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onFallbackTickRef.current = onFallbackTick
  }, [onFallbackTick])

  useEffect(() => {
    if (!enabled) return
    if (!storyId) return
    if (typeof window === "undefined") return

    let stopPolling: (() => void) | null = null
    const startFallback = () => {
      if (stopPolling) return
      const tick = onFallbackTickRef.current
      if (!tick) return
      stopPolling = startPolling(tick, 4000)
    }

    if (typeof EventSource === "undefined") {
      startFallback()
      return () => {
        stopPolling?.()
      }
    }

    const u = new URL("/api/video-creation/images/events", window.location.origin)
    u.searchParams.set("storyId", storyId)
    if (storyboardId) u.searchParams.set("storyboardId", storyboardId)
    u.searchParams.set("includeGlobal", includeGlobal ? "true" : "false")
    const cursor = cursorRef.current.trim()
    if (cursor) u.searchParams.set("cursor", cursor)

    const es = new EventSource(u.toString())
    const onMessage = (raw: MessageEvent) => {
      const id = String((raw as any)?.lastEventId ?? "").trim()
      if (id) cursorRef.current = id
      try {
        const parsed = JSON.parse(String(raw.data ?? "{}")) as Partial<VideoImageEvent>
        const imageId = typeof parsed.id === "string" ? parsed.id.trim() : ""
        if (!imageId) return
        onEventRef.current({
          id: imageId,
          storyboardId: typeof parsed.storyboardId === "string" ? parsed.storyboardId : null,
          category: typeof parsed.category === "string" ? parsed.category : "",
          name: typeof parsed.name === "string" ? parsed.name : "",
          status: typeof parsed.status === "string" ? parsed.status : undefined
        })
      } catch {
      }
    }

    es.addEventListener("image", onMessage as any)
    es.onerror = () => {
      es.close()
      startFallback()
    }

    return () => {
      es.close()
      stopPolling?.()
    }
  }, [enabled, includeGlobal, storyboardId, storyId])
}
