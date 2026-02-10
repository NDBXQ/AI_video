"use client"

import { useMemo } from "react"

export function useTvcTelemetry(): (event: string, payload: Record<string, unknown>) => void {
  return useMemo(() => {
    const getClientTraceId = (): string => {
      try {
        const key = "tvc_trace_id"
        const existing = sessionStorage.getItem(key)
        if (existing && existing.trim()) return existing.trim()
        const next = crypto.randomUUID()
        sessionStorage.setItem(key, next)
        return next
      } catch {
        return crypto.randomUUID()
      }
    }

    return (event: string, payload: Record<string, unknown>) => {
      const traceId = getClientTraceId()
      const body = { event, page: "/tvc", payload }
      try {
        void fetch("/api/telemetry/events", {
          method: "POST",
          headers: { "content-type": "application/json", "x-trace-id": traceId },
          body: JSON.stringify(body),
          keepalive: true
        })
      } catch {}
    }
  }, [])
}
