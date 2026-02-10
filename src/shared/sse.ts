export type SseMessage = {
  event?: string
  data: string
}

export type SseCursor = {
  ms: number
  id: string
}

export function formatSseCursor(updatedAt: Date, id: string): string {
  const ms = updatedAt instanceof Date ? updatedAt.getTime() : Date.now()
  const safeId = String(id ?? "")
  return `${ms}:${safeId}`
}

function parseSseCursor(cursor: string): SseCursor {
  const s = String(cursor ?? "").trim()
  if (!s) return { ms: 0, id: "" }
  const idx = s.indexOf(":")
  if (idx < 0) {
    const msOnly = Number(s)
    return { ms: Number.isFinite(msOnly) ? Math.trunc(msOnly) : 0, id: "" }
  }
  const msStr = s.slice(0, idx)
  const id = s.slice(idx + 1)
  const ms = Number(msStr)
  return { ms: Number.isFinite(ms) ? Math.trunc(ms) : 0, id: String(id ?? "") }
}

export function getSseCursorFromRequest(req: Request, fallback?: string): SseCursor {
  const fromHeader = (req.headers.get("last-event-id") ?? "").trim()
  if (fromHeader) return parseSseCursor(fromHeader)
  if (fallback && String(fallback).trim()) return parseSseCursor(String(fallback))
  return { ms: 0, id: "" }
}

export async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  const duration = Number.isFinite(Number(ms)) ? Math.max(0, Math.trunc(Number(ms))) : 0
  if (!signal) {
    await new Promise<void>((resolve) => setTimeout(resolve, duration))
    return
  }
  if (signal.aborted) return

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, duration)
    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
      resolve()
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

export function createSseDecoder(): {
  push: (chunk: string) => SseMessage[]
  flush: () => SseMessage[]
} {
  let buffer = ""

  const consume = (): SseMessage[] => {
    const events: SseMessage[] = []
    while (true) {
      const idx = buffer.indexOf("\n\n")
      if (idx < 0) break
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (!block.trim()) continue

      let eventName: string | undefined
      const dataLines: string[] = []
      for (const rawLine of block.split("\n")) {
        if (!rawLine) continue
        if (rawLine.startsWith(":")) continue
        const sep = rawLine.indexOf(":")
        const field = sep >= 0 ? rawLine.slice(0, sep) : rawLine
        const rest = sep >= 0 ? rawLine.slice(sep + 1) : ""
        const value = rest.startsWith(" ") ? rest.slice(1) : rest

        if (field === "event") {
          const t = value.trim()
          if (t) eventName = t
        } else if (field === "data") {
          dataLines.push(value)
        }
      }

      if (dataLines.length > 0) {
        events.push({ event: eventName, data: dataLines.join("\n") })
      }
    }
    return events
  }

  const normalize = (input: string) => input.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  return {
    push: (chunk) => {
      buffer += normalize(chunk)
      return consume()
    },
    flush: () => {
      buffer += "\n\n"
      return consume()
    }
  }
}
