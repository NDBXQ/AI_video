import type { TvcAgentBlock, TvcAgentResponse } from "./types"

function normalizeText(v: string): string {
  return v.replace(/\r\n/g, "\n").trim()
}

function safeParseXml(xml: string): Document | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "application/xml")
    if (doc.getElementsByTagName("parsererror").length > 0) return null
    return doc
  } catch {
    return null
  }
}

export function parseActionsFromText(text: string): Array<{ command: string; text: string }> {
  const actions: Array<{ command: string; text: string }> = []
  const lines = normalizeText(text ?? "").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.includes("👉")) continue
    const m = trimmed.match(/输入"([^"]+)"/)
    if (!m) continue
    const command = (m[1] ?? "").trim()
    if (!command) continue
    actions.push({ command, text: trimmed })
  }
  return actions
}

export function parseResponseXml(responseXml: string): TvcAgentResponse | null {
  const doc = safeParseXml(responseXml)
  if (!doc) return null
  const root = doc.getElementsByTagName("response")[0]
  if (!root) return null
  const text = normalizeText(root.textContent ?? "")
  return { text, actions: parseActionsFromText(text) }
}

export function parseAgentBlocks(rawText: string): TvcAgentBlock[] {
  const raw = rawText ?? ""
  const blocks: TvcAgentBlock[] = []
  let i = 0

  while (i < raw.length) {
    const nextResp = raw.indexOf("<response", i)
    const next = [nextResp].filter((n) => n >= 0).sort((a, b) => a - b)[0]
    if (next === undefined) break

    if (next > i) {
      const text = raw.slice(i, next)
      if (text.trim()) blocks.push({ kind: "text", text })
    }

    if (next === nextResp) {
      const end = raw.indexOf("</response>", nextResp)
      if (end < 0) {
        const tail = raw.slice(nextResp)
        if (tail.trim()) blocks.push({ kind: "text", text: tail })
        return blocks
      }
      const xml = raw.slice(nextResp, end + "</response>".length)
      blocks.push({ kind: "response", raw: xml, response: parseResponseXml(xml) })
      i = end + "</response>".length
      continue
    }
  }

  const rest = raw.slice(i)
  if (rest.trim()) blocks.push({ kind: "text", text: rest })
  return blocks
}
