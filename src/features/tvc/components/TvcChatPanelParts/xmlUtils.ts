export function stripXmlTags(v: string): string {
  return (v ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function stripTaggedBlocks(text: string, tag: string): string {
  const t = String(text ?? "")
  const safeTag = String(tag ?? "").trim()
  if (!safeTag) return t
  const re = new RegExp(`<${safeTag}[^>]*>[\\s\\S]*?<\\/${safeTag}>`, "gi")
  return t.replace(re, "")
}

export function stripTvcAssistantEnvelope(text: string): string {
  let t = String(text ?? "")
  t = stripTaggedBlocks(t, "clarification")
  t = stripTaggedBlocks(t, "script")
  t = stripTaggedBlocks(t, "storyboards")
  t = stripTaggedBlocks(t, "step")
  t = stripTaggedBlocks(t, "response")
  return t.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}
