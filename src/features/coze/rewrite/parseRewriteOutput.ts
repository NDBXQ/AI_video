import { z } from "zod"

export const rewriteOutputSchema = z.object({
  new_title: z.string().min(1),
  new_content: z.string().min(1),
  rewrite_notes: z.string().min(1),
  friendly_tip: z.string().min(1)
})

export type RewriteOutput = z.infer<typeof rewriteOutputSchema>

function normalizeOutputKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input }

  if (out["new-title"] && !out["new_title"]) out["new_title"] = out["new-title"]
  if (out["new-content"] && !out["new_content"]) out["new_content"] = out["new-content"]
  if (out["rewrite-notes"] && !out["rewrite_notes"]) out["rewrite_notes"] = out["rewrite-notes"]
  if (out["friendly-tip"] && !out["friendly_tip"]) out["friendly_tip"] = out["friendly-tip"]

  return out
}

function extractTag(text: string, tag: string): string | undefined {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, "i")
  const m = text.match(re)
  if (!m) return undefined
  const value = m[1].trim()
  return value ? value : undefined
}

function extractTaggedOutput(text: string): Record<string, unknown> | null {
  const newTitle = extractTag(text, "new-title") ?? extractTag(text, "new_title")
  const newContent = extractTag(text, "new-content") ?? extractTag(text, "new_content")
  const rewriteNotes = extractTag(text, "rewrite-notes") ?? extractTag(text, "rewrite_notes")
  const friendlyTip = extractTag(text, "friendly-tip") ?? extractTag(text, "friendly_tip")

  if (!newTitle || !newContent || !rewriteNotes || !friendlyTip) return null
  return {
    new_title: newTitle,
    new_content: newContent,
    rewrite_notes: rewriteNotes,
    friendly_tip: friendlyTip
  }
}

export function parseRewriteOutput(data: unknown): RewriteOutput | null {
  const candidate =
    data && typeof data === "object" && data !== null && "data" in data
      ? (data as { data?: unknown }).data
      : data

  if (typeof candidate === "string") {
    const trimmed = candidate.trim()
    const tagged = extractTaggedOutput(trimmed)
    if (tagged) {
      const parsed = rewriteOutputSchema.safeParse(tagged)
      if (parsed.success) return parsed.data
    }

    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const normalized = normalizeOutputKeys(obj as Record<string, unknown>)
        const parsed = rewriteOutputSchema.safeParse(normalized)
        if (parsed.success) return parsed.data
      }
    } catch {}
  }

  const normalized =
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? normalizeOutputKeys(candidate as Record<string, unknown>)
      : candidate
  const parsed = rewriteOutputSchema.safeParse(normalized)
  if (parsed.success) return parsed.data

  return null
}

