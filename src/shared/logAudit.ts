import { logger } from "@/shared/logger"

type AuditBase = {
  traceId: string
  storyId?: string
  runId?: string
}

export function isContextAuditEnabled(): boolean {
  const v = String(process.env.TVC_CONTEXT_AUDIT_LOG ?? "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes" || v === "on"
}

function getContextAuditLogLevel(): "debug" | "info" {
  const v = String(process.env.TVC_CONTEXT_AUDIT_LOG_LEVEL ?? "").trim().toLowerCase()
  return v === "info" ? "info" : "debug"
}

export function toSnippet(value: unknown, maxChars = 300): { text: string; length: number } {
  const s = typeof value === "string" ? value : value == null ? "" : safeJsonStringify(value)
  const normalized = s.replace(/\r\n/g, "\n")
  const length = normalized.length
  if (length <= maxChars) return { text: normalized, length }
  return { text: normalized.slice(0, maxChars), length }
}

export function summarizeRecordKeys(value: unknown, maxKeys = 30): { keys: string[]; keyCount: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { keys: [], keyCount: 0 }
  const keys = Object.keys(value as Record<string, unknown>)
  if (keys.length <= maxKeys) return { keys, keyCount: keys.length }
  return { keys: keys.slice(0, maxKeys), keyCount: keys.length }
}

export function normalizeError(err: unknown): { errorName: string; errorMessage: string; stack?: string } {
  const anyErr = err as any
  const errorName = String(anyErr?.name ?? "Error")
  const errorMessage = String(anyErr?.message ?? "unknown error")
  const stack = typeof anyErr?.stack === "string" ? anyErr.stack : undefined
  return { errorName, errorMessage, ...(stack ? { stack } : {}) }
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function summarizeLlmMessage(m: {
  role?: unknown
  content?: unknown
  name?: unknown
  tool_call_id?: unknown
  tool_calls?: unknown
}): Record<string, unknown> {
  const role = String(m?.role ?? "").trim()
  const name = typeof m?.name === "string" ? m.name : null
  const toolCallId = typeof m?.tool_call_id === "string" ? m.tool_call_id : null
  const toolCallsCount = Array.isArray(m?.tool_calls) ? m.tool_calls.length : 0
  const { text, length } = toSnippet(typeof m?.content === "string" ? m.content : "", 240)
  const summary: Record<string, unknown> = { role, contentLen: length }
  if (text.trim()) summary.contentSnippet = text
  if (name) summary.name = name
  if (toolCallId) summary.toolCallId = toolCallId
  if (toolCallsCount) summary.toolCallsCount = toolCallsCount
  return summary
}

export function auditInfo(module: string, event: string, message: string, base: AuditBase, extra?: Record<string, unknown>): void {
  if (!isContextAuditEnabled()) return
  logger.info({ module, event, traceId: base.traceId, message, ...(base.storyId ? { storyId: base.storyId } : {}), ...(base.runId ? { runId: base.runId } : {}), ...(extra ?? {}) })
}

export function auditDebug(module: string, event: string, message: string, base: AuditBase, extra?: Record<string, unknown>): void {
  if (!isContextAuditEnabled()) return
  const payload = { module, event, traceId: base.traceId, message, ...(base.storyId ? { storyId: base.storyId } : {}), ...(base.runId ? { runId: base.runId } : {}), ...(extra ?? {}) }
  const level = getContextAuditLogLevel()
  if (level === "info") {
    logger.info(payload)
    return
  }
  logger.debug(payload)
}

export function auditWarn(module: string, event: string, message: string, base: AuditBase, extra?: Record<string, unknown>): void {
  if (!isContextAuditEnabled()) return
  logger.warn({ module, event, traceId: base.traceId, message, ...(base.storyId ? { storyId: base.storyId } : {}), ...(base.runId ? { runId: base.runId } : {}), ...(extra ?? {}) })
}

export function auditError(module: string, event: string, message: string, base: AuditBase, extra?: Record<string, unknown>): void {
  if (!isContextAuditEnabled()) return
  logger.error({ module, event, traceId: base.traceId, message, ...(base.storyId ? { storyId: base.storyId } : {}), ...(base.runId ? { runId: base.runId } : {}), ...(extra ?? {}) })
}
