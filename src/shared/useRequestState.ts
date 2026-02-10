"use client"

import { useCallback, useRef, useState } from "react"
import type { ApiResult } from "@/shared/apiClient"
import type { RequestError, RequestState } from "@/shared/requestStatus"

function toRequestError(input: unknown): RequestError {
  const anyErr = input as { code?: unknown; message?: unknown }
  const code = typeof anyErr?.code === "string" && anyErr.code.trim() ? anyErr.code.trim() : "UNKNOWN"
  const message = typeof anyErr?.message === "string" && anyErr.message.trim() ? anyErr.message.trim() : "请求失败"
  return { code, message }
}

export function useRequestState<T>(): {
  state: RequestState<T>
  reset: () => void
  run: (fn: (signal: AbortSignal) => Promise<ApiResult<T>>) => Promise<ApiResult<T> | null>
  abort: () => void
} {
  const [state, setState] = useState<RequestState<T>>({ status: "idle" })
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState({ status: "idle" })
  }, [])

  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<ApiResult<T>>): Promise<ApiResult<T> | null> => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const startedAt = Date.now()
    setState({ status: "pending", startedAt })

    try {
      const res = await fn(ctrl.signal)
      if (res.ok) {
        setState({ status: "success", startedAt, finishedAt: Date.now(), data: res.data, traceId: res.traceId })
      } else {
        setState({ status: "error", startedAt, finishedAt: Date.now(), error: toRequestError(res.error), traceId: res.traceId })
      }
      return res
    } catch (e) {
      if ((e as any)?.name === "AbortError") {
        setState({ status: "idle" })
        return null
      }
      const err = toRequestError({ code: "UNKNOWN", message: (e as any)?.message ?? "请求失败" })
      setState({ status: "error", startedAt, finishedAt: Date.now(), error: err, traceId: "n/a" })
      return { ok: false, error: err, traceId: "n/a" }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
    }
  }, [])

  return { state, reset, run, abort }
}

