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
  try {
    host = new URL(url).host
  } catch {}

  logger.info({
    event: "coze_run_request_start",
    module,
    traceId,
    message: "开始请求 Coze run endpoint",
    host,
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
