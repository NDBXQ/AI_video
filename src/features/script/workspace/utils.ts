
export type ScriptWorkspaceMode = "source" | "brief"

export type RewriteOutput = {
  new_title: string
  new_content: string
  rewrite_notes: string
  friendly_tip: string
}

export type RewriteStatus = "idle" | "streaming" | "done" | "error"

export type RewriteState = {
  status: RewriteStatus
  raw: string
  requirements?: string
  result?: RewriteOutput
  error?: string
}

export type ThreadMessage = {
  id: string
  role: "assistant" | "user"
  text: string
  outlineSequence?: number
}

export type OutlineItem = {
  outlineId: string
  sequence: number
  outlineText: string
  originalText: string
  outlineDrafts: Array<{ id: string; title?: string | null; content: string; requirements?: string | null; createdAt: string }>
  activeOutlineDraftId?: string | null
}

export function extractBetween(text: string, startTag: string, endTag: string): string | undefined {
  const start = text.indexOf(startTag)
  if (start < 0) return undefined
  const contentStart = start + startTag.length
  const end = text.indexOf(endTag, contentStart)
  if (end < 0) return text.slice(contentStart)
  return text.slice(contentStart, end)
}

export function pickRewriteFieldFromRaw(raw: string, tagName: string): string | undefined {
  const openA = `<${tagName}>`
  const closeA = `</${tagName}>`
  const fromA = extractBetween(raw, openA, closeA)?.trim()
  if (fromA) return fromA

  const snake = tagName.replaceAll("-", "_")
  const openB = `<${snake}>`
  const closeB = `</${snake}>`
  const fromB = extractBetween(raw, openB, closeB)?.trim()
  if (fromB) return fromB

  return undefined
}

export function deriveLiveRewrite(raw: string): { title?: string; content?: string; notes?: string; tip?: string } {
  return {
    title: pickRewriteFieldFromRaw(raw, "new-title"),
    content: pickRewriteFieldFromRaw(raw, "new-content"),
    notes: pickRewriteFieldFromRaw(raw, "rewrite-notes"),
    tip: pickRewriteFieldFromRaw(raw, "friendly-tip")
  }
}

export function pickRewriteFieldFromRawStreaming(raw: string, tagName: string): string | undefined {
  const open = `<${tagName}>`
  const start = raw.indexOf(open)
  if (start < 0) return undefined
  const contentStart = start + open.length
  const close = `</${tagName}>`
  const end = raw.indexOf(close, contentStart)
  if (end >= 0) return raw.slice(contentStart, end).trim()

  const nextTag = raw.indexOf("<", contentStart)
  if (nextTag >= 0) return raw.slice(contentStart, nextTag).trim()
  return raw.slice(contentStart).trim()
}

export function deriveLiveRewriteStreaming(raw: string): { notes?: string; tip?: string } {
  const notes = pickRewriteFieldFromRawStreaming(raw, "rewrite-notes")
  const tip = pickRewriteFieldFromRawStreaming(raw, "friendly-tip")
  return { notes: notes || undefined, tip: tip || undefined }
}

export function normalizeAssistantText(text: string): string {
  const trimmed = text.trim()
  const stripped = trimmed
    .replace(/^改写说明[:：]\s*/i, "")
    .replace(/^温馨提示[:：]\s*/i, "")
    .replace(/^温馨提示[:：]\s*温馨提示[:：]\s*/i, "")
    .trim()
  return stripped
}
