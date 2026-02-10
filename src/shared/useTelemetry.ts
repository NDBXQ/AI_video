"use client"

import { useMemo } from "react"

type TelemetryPayload = Record<string, unknown>

type UseTelemetryOptions = Readonly<{
  page: string
  traceKey?: string
}>

export function useTelemetry({ page, traceKey }: UseTelemetryOptions): (event: string, payload?: TelemetryPayload) => void {
  return useMemo(() => {
    const key = traceKey?.trim() || `telemetry_trace_id:${page}`
    const getClientTraceId = (): string => {
      try {
        const existing = sessionStorage.getItem(key)
        if (existing && existing.trim()) return existing.trim()
        const next = crypto.randomUUID()
        sessionStorage.setItem(key, next)
        return next
      } catch {
        return crypto.randomUUID()
      }
    }

    return (event: string, payload: TelemetryPayload = {}) => {
      const traceId = getClientTraceId()
      const body = { event, page, payload }
      try {
        void fetch("/api/telemetry/events", {
          method: "POST",
          headers: { "content-type": "application/json", "x-trace-id": traceId },
          body: JSON.stringify(body),
          keepalive: true
        })
      } catch {}
    }
  }, [page, traceKey])
}
