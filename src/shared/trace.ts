/**
 * 获取或生成 traceId
 * @param {Headers} headers - 请求头
 * @returns {string} traceId
 */
export function getTraceId(headers: Headers): string {
  const fromHeader =
    headers.get("x-trace-id") ?? headers.get("x-request-id") ?? undefined

  if (fromHeader && fromHeader.trim()) {
    return fromHeader.trim()
  }

  return crypto.randomUUID()
}

