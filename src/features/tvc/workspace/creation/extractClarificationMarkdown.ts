"use client"

export function extractClarificationMarkdown(assets: unknown[]): string {
  if (!Array.isArray(assets) || assets.length === 0) return ""
  for (const a of assets) {
    const rec = a as any
    const kind = String(rec?.kind ?? "").trim()
    if (kind !== "clarification") continue
    const meta = (rec?.meta ?? {}) as any
    const markdown = String(meta?.markdown ?? "").trim()
    if (markdown) return markdown
  }
  return ""
}

