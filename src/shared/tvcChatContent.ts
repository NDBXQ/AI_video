export type TvcChatAttachment =
  | {
      kind: "image"
      url: string
      index?: number
    }

const UPLOAD_IMAGES_BEGIN = "[TVC_UPLOAD_IMAGES]"
const UPLOAD_IMAGES_END = "[/TVC_UPLOAD_IMAGES]"

function parseUploadImagesPayload(raw: string): Array<{ url: string; index?: number }> {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const withoutFence = (() => {
    if (!trimmed.startsWith("```")) return trimmed
    const firstNewline = trimmed.indexOf("\n")
    if (firstNewline < 0) return ""
    const rest = trimmed.slice(firstNewline + 1)
    const lastFence = rest.lastIndexOf("```")
    if (lastFence < 0) return ""
    return rest.slice(0, lastFence).trim()
  })()

  try {
    const parsed = JSON.parse(withoutFence)
    const images = Array.isArray(parsed?.images) ? (parsed.images as any[]) : []
    return images
      .map((it) => {
        const url = String(it?.url ?? "").trim()
        const idx = Number(it?.index)
        const index = Number.isFinite(idx) && idx > 0 ? Math.trunc(idx) : undefined
        if (!url) return null
        return { url, ...(index ? { index } : {}) }
      })
      .filter(Boolean) as Array<{ url: string; index?: number }>
  } catch {
    return []
  }
}

export function encodeUploadImagesMessage(input: { text: string; images: Array<{ url: string; index?: number }> }): string {
  const text = String(input.text ?? "")
  const images = (input.images ?? [])
    .map((it) => {
      const url = String(it?.url ?? "").trim()
      const idx = Number(it?.index)
      const index = Number.isFinite(idx) && idx > 0 ? Math.trunc(idx) : undefined
      if (!url) return null
      return { url, ...(index ? { index } : {}) }
    })
    .filter(Boolean) as Array<{ url: string; index?: number }>

  if (images.length === 0) return text

  const payload = JSON.stringify({ images })
  return [text.trimEnd(), "", UPLOAD_IMAGES_BEGIN, payload, UPLOAD_IMAGES_END].join("\n")
}

export function parseChatContent(raw: string): { text: string; attachments: TvcChatAttachment[] } {
  let text = String(raw ?? "")
  const attachments: TvcChatAttachment[] = []

  while (true) {
    const start = text.indexOf(UPLOAD_IMAGES_BEGIN)
    if (start < 0) break
    const end = text.indexOf(UPLOAD_IMAGES_END, start + UPLOAD_IMAGES_BEGIN.length)
    if (end < 0) break
    const payloadRaw = text.slice(start + UPLOAD_IMAGES_BEGIN.length, end)
    const images = parseUploadImagesPayload(payloadRaw)
    for (const img of images) {
      const url = String(img.url ?? "").trim()
      if (!url) continue
      attachments.push({ kind: "image", url, ...(typeof img.index === "number" ? { index: img.index } : {}) })
    }
    text = `${text.slice(0, start).trimEnd()}\n${text.slice(end + UPLOAD_IMAGES_END.length).trimStart()}`
  }

  return { text: text.trim(), attachments }
}

export function stripChatContentForModel(raw: string): string {
  return parseChatContent(raw).text
}

