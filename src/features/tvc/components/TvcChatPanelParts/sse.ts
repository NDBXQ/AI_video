export type SseMessage = {
  event?: string
  data: string
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

