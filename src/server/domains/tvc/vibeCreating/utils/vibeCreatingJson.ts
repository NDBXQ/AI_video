export function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function tryExtractJsonObject(text: string): string | null {
  const raw = text ?? ""
  const first = raw.indexOf("{")
  const last = raw.lastIndexOf("}")
  if (first < 0 || last < 0 || last <= first) return null
  const sliced = raw.slice(first, last + 1).trim()
  return sliced ? sliced : null
}

