import { logger } from "@/shared/logger"
import { readEnvInt } from "@/features/coze/env"

type CallCozeRunEndpointInput = {
  traceId: string
  url: string
  token: string
  body: unknown
  module: string
  timeoutMs?: number
}

export class CozeRunEndpointError extends Error {
  status?: number
  bodySnippet?: string

  constructor(message: string, input?: { status?: number; bodySnippet?: string }) {
    super(message)
    this.name = "CozeRunEndpointError"
    this.status = input?.status
    this.bodySnippet = input?.bodySnippet
  }
}

function truncateForLog(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}

function summarizeBodyForLog(body: unknown): { bodyType: string; bodyBytes?: number; topKeys?: string[] } {
  const bodyType = Array.isArray(body) ? "array" : body === null ? "null" : typeof body
  let bodyBytes: number | undefined
  let topKeys: string[] | undefined
  if (body && typeof body === "object" && !Array.isArray(body)) {
    topKeys = Object.keys(body as Record<string, unknown>).slice(0, 12)
  }
  try {
    const s = JSON.stringify(body)
    bodyBytes = Buffer.byteLength(s, "utf8")
  } catch {}
  return { bodyType, bodyBytes, topKeys }
}

function parseSsePayload(rawText: string): unknown[] {
  const items: unknown[] = []
  const blocks = rawText.split("\n\n")
  for (const block of blocks) {
    const lines = block.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const dataPart = trimmed.slice("data:".length).trim()
      if (!dataPart || dataPart === "[DONE]") continue
      try {
        items.push(JSON.parse(dataPart))
      } catch {}
    }
  }
  return items
}

function extractSseResult(items: unknown[]): { ok: true; data: unknown } | { ok: false; error: unknown } | null {
  if (items.length === 0) return null

  let errorPayload: unknown | undefined
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const anyItem = item as Record<string, unknown>
    const type = anyItem["type"]
    const content = anyItem["content"]

    if (type === "error") {
      const err =
        content && typeof content === "object" ? (content as Record<string, unknown>)["error"] : undefined
      errorPayload = err ?? item
      break
    }

    if (content && typeof content === "object") {
      const err = (content as Record<string, unknown>)["error"]
      if (err) {
        errorPayload = err
        break
      }
    }
  }

  if (errorPayload) return { ok: false, error: errorPayload }

  let answerText = ""
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const anyItem = item as Record<string, unknown>
    if (anyItem["type"] !== "answer") continue
    const content = anyItem["content"]
    if (!content || typeof content !== "object") continue
    const chunk = (content as Record<string, unknown>)["answer"]
    if (typeof chunk === "string") answerText += chunk
  }

  const trimmed = answerText.trim()
  if (trimmed) {
    try {
      return { ok: true, data: JSON.parse(trimmed) }
    } catch {
      return { ok: true, data: trimmed }
    }
  }

  const last = items[items.length - 1]
  return { ok: true, data: last }
}

export async function callCozeRunEndpoint(input: CallCozeRunEndpointInput): Promise<{
  status: number
  data: unknown
  durationMs: number
}> {
  const timeoutFromEnv = readEnvInt("COZE_REQUEST_TIMEOUT_MS")
  const resolvedTimeoutMs = input.timeoutMs ?? timeoutFromEnv ?? 60_000
  const { traceId, url, token, body, module } = input
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), resolvedTimeoutMs)

  let host = "unknown"
  let pathname = ""
  try {
    const u = new URL(url)
    host = u.host
    pathname = u.pathname
  } catch {}

  logger.info({
    event: "coze_run_request_start",
    module,
    traceId,
    message: "开始请求 Coze run endpoint",
    host,
    path: pathname,
    ...summarizeBodyForLog(body),
    timeoutMs: resolvedTimeoutMs
  })

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    const durationMs = Date.now() - start
    const contentType = resp.headers.get("content-type") ?? ""
    const rawText = await resp.text()

    if (contentType.includes("text/event-stream")) {
      const items = parseSsePayload(rawText)
      const extracted = extractSseResult(items)

      if (!extracted) {
        logger.error({
          event: "coze_run_request_failed",
          module,
          traceId,
          message: "Coze SSE 回包解析失败",
          host,
          path: pathname,
          status: resp.status,
          durationMs,
          bodySnippet: truncateForLog(rawText, 500)
        })
        throw new CozeRunEndpointError("Coze SSE 回包解析失败", {
          status: resp.status,
          bodySnippet: truncateForLog(rawText, 500)
        })
      }

      if (!extracted.ok) {
        const bodySnippet = truncateForLog(JSON.stringify(extracted.error), 500)
        logger.error({
          event: "coze_run_request_failed",
          module,
          traceId,
          message: "Coze SSE 返回错误",
          host,
          path: pathname,
          status: resp.status,
          durationMs,
          bodySnippet
        })
        throw new CozeRunEndpointError("Coze run endpoint 返回错误", {
          status: resp.status,
          bodySnippet
        })
      }

      logger.info({
        event: "coze_run_request_success",
        module,
        traceId,
        message: "Coze run endpoint 请求成功",
        host,
        path: pathname,
        status: resp.status,
        durationMs
      })

      return { status: resp.status, data: extracted.data, durationMs }
    }

    let parsed: unknown = rawText
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(rawText)
      } catch {
        parsed = rawText
      }
    } else {
      try {
        parsed = JSON.parse(rawText)
      } catch {
        parsed = rawText
      }
    }

    if (!resp.ok) {
      const bodySnippet =
        typeof parsed === "string"
          ? truncateForLog(parsed, 500)
          : truncateForLog(JSON.stringify(parsed), 500)

      logger.error({
        event: "coze_run_request_failed",
        module,
        traceId,
        message: "Coze run endpoint 请求失败",
        host,
        path: pathname,
        status: resp.status,
        durationMs,
        bodySnippet
      })

      throw new CozeRunEndpointError("Coze run endpoint 请求失败", {
        status: resp.status,
        bodySnippet
      })
    }

    logger.info({
      event: "coze_run_request_success",
      module,
      traceId,
      message: "Coze run endpoint 请求成功",
      host,
      path: pathname,
      status: resp.status,
      durationMs
    })

    return { status: resp.status, data: parsed, durationMs }
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    const isAbort = anyErr?.name === "AbortError"

    logger.error({
      event: "coze_run_request_error",
      module,
      traceId,
      message: isAbort ? "Coze run endpoint 请求超时" : "Coze run endpoint 请求异常",
      host,
      path: pathname,
      durationMs,
      timeoutMs: resolvedTimeoutMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    if (err instanceof CozeRunEndpointError) throw err
    throw new CozeRunEndpointError(isAbort ? "Coze run endpoint 请求超时" : "Coze run endpoint 请求异常")
  } finally {
    clearTimeout(timer)
  }
}
