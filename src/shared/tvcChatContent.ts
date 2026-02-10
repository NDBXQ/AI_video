export type TvcChatAttachment =
  | {
      kind: "image"
      url: string
      index?: number
      assetKind?: "user_image" | "reference_image" | "first_frame" | "video_clip"
      assetOrdinal?: number
    }

const UPLOAD_IMAGES_BEGIN = "[TVC_UPLOAD_IMAGES]"
const UPLOAD_IMAGES_END = "[/TVC_UPLOAD_IMAGES]"
const UPLOAD_ASSETS_BEGIN = "[TVC_UPLOAD_ASSETS]"
const UPLOAD_ASSETS_END = "[/TVC_UPLOAD_ASSETS]"

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

function parseUploadAssetsPayload(
  raw: string
): Array<{ kind: "user_image" | "reference_image" | "first_frame" | "video_clip"; ordinal: number; url?: string }> {
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
    const assets = Array.isArray(parsed?.assets) ? (parsed.assets as any[]) : []
    return assets
      .map((it) => {
        const kind = String(it?.kind ?? "").trim() as any
        if (!["user_image", "reference_image", "first_frame", "video_clip"].includes(kind)) return null
        const ordinalRaw = Number(it?.ordinal)
        const ordinal = Number.isFinite(ordinalRaw) && ordinalRaw > 0 ? Math.trunc(ordinalRaw) : 0
        if (!ordinal) return null
        const url = String(it?.url ?? "").trim()
        return { kind, ordinal, ...(url ? { url } : {}) }
      })
      .filter(Boolean) as Array<{ kind: "user_image" | "reference_image" | "first_frame" | "video_clip"; ordinal: number; url?: string }>
  } catch {
    return []
  }
}

export function encodeUploadAssetsMessage(input: {
  text: string
  assets: Array<{ kind: "user_image" | "reference_image" | "first_frame" | "video_clip"; ordinal: number; url?: string }>
}): string {
  const text = String(input.text ?? "")
  const assets = (input.assets ?? [])
    .map((it) => {
      const kind = String(it?.kind ?? "").trim() as any
      if (!["user_image", "reference_image", "first_frame", "video_clip"].includes(kind)) return null
      const ordinalRaw = Number(it?.ordinal)
      const ordinal = Number.isFinite(ordinalRaw) && ordinalRaw > 0 ? Math.trunc(ordinalRaw) : 0
      if (!ordinal) return null
      const url = String(it?.url ?? "").trim()
      return { kind, ordinal, ...(url ? { url } : {}) }
    })
    .filter(Boolean) as Array<{ kind: "user_image" | "reference_image" | "first_frame" | "video_clip"; ordinal: number; url?: string }>

  if (assets.length === 0) return text

  const payload = JSON.stringify({ assets })
  return [text.trimEnd(), "", UPLOAD_ASSETS_BEGIN, payload, UPLOAD_ASSETS_END].join("\n")
}

export function parseChatContent(raw: string): { text: string; attachments: TvcChatAttachment[] } {
  let text = String(raw ?? "")
  const attachments: TvcChatAttachment[] = []

  while (true) {
    const start = text.indexOf(UPLOAD_ASSETS_BEGIN)
    if (start < 0) break
    const end = text.indexOf(UPLOAD_ASSETS_END, start + UPLOAD_ASSETS_BEGIN.length)
    if (end < 0) break
    const payloadRaw = text.slice(start + UPLOAD_ASSETS_BEGIN.length, end)
    const assets = parseUploadAssetsPayload(payloadRaw)
    for (const a of assets) {
      const url = String(a.url ?? "").trim()
      if (!url) continue
      attachments.push({ kind: "image", url, assetKind: a.kind, assetOrdinal: a.ordinal })
    }
    text = `${text.slice(0, start).trimEnd()}\n${text.slice(end + UPLOAD_ASSETS_END.length).trimStart()}`
  }

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
