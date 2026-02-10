export function describeUpstreamError(err: unknown): string {
  const anyErr = err as any
  const msg = String(anyErr?.message ?? "unknown error")
  const status = anyErr?.response?.status ?? anyErr?.status ?? anyErr?.statusCode
  const data = anyErr?.response?.data
  const dataText =
    data == null
      ? ""
      : typeof data === "string"
        ? data
        : (() => {
            try {
              return JSON.stringify(data)
            } catch {
              return String(data)
            }
          })()
  const parts = [typeof status === "number" ? `HTTP ${status}` : "", msg, dataText ? dataText.slice(0, 500) : ""].filter(Boolean)
  return parts.join(" | ")
}
