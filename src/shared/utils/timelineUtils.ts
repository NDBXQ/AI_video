export type TimelineSegment = {
  id: string
  title: string
  videoSrc?: string | null
  durationSeconds?: number | null
}

export type AudioAsset = { id: string; name: string; kind: "audio"; src?: string; durationSeconds?: number | null }
export type VideoAsset = { id: string; name: string; kind: "video"; src?: string; durationSeconds?: number | null }
export type MediaAsset = { id: string; name: string; kind: "media"; src?: string }
export type Asset = AudioAsset | VideoAsset | MediaAsset

export type VideoClip = {
  id: string
  segmentId: string
  title: string
  src?: string
  start: number
  duration: number
  trimStart: number
  trimEnd: number
}

export type AudioClip = {
  id: string
  assetId: string
  name: string
  start: number
  duration: number
  src?: string
}

export const PX_PER_SECOND = 48
export const MIN_CLIP_SECONDS = 0.5
export const ASSET_MIME = "application/x-ai-video-asset"
export const CLIP_MIME = "application/x-ai-video-clip"
export const TRACK_OFFSET_PX = 72
export const TRACK_RIGHT_PADDING_PX = 10

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

export function safeDuration(seg: TimelineSegment): number {
  const raw = Number(seg.durationSeconds ?? 0)
  if (Number.isFinite(raw) && raw > 0) return raw
  return seg.videoSrc ? 2 : 2
}

export function parseAsset(dt: DataTransfer): Asset | null {
  const json = dt.getData(ASSET_MIME) || dt.getData("text/plain")
  if (!json) return null
  try {
    const v = JSON.parse(json) as Partial<Asset>
    if (!v || typeof v !== "object") return null
    if (v.kind === "audio" || v.kind === "media" || v.kind === "video") {
      const id = typeof v.id === "string" ? v.id : ""
      const name = typeof v.name === "string" ? v.name : ""
      const src = typeof v.src === "string" ? v.src : undefined
      if (!id || !name) return null
      if (v.kind === "audio") {
        const durationSeconds = typeof (v as any).durationSeconds === "number" ? (v as any).durationSeconds : null
        return { id, name, kind: "audio", src, durationSeconds }
      }
      if (v.kind === "video") {
        const durationSeconds = typeof (v as any).durationSeconds === "number" ? (v as any).durationSeconds : null
        return { id, name, kind: "video", src, durationSeconds }
      }
      return { id, name, kind: "media", src }
    }
    return null
  } catch {
    return null
  }
}

export const clipLeftPx = (start: number) => Math.round(start * PX_PER_SECOND)
export const clipWidthPx = (duration: number) => Math.round(duration * PX_PER_SECOND)

export type DraggedClip = {
  type: "video" | "audio"
  id: string
  segmentId?: string
  title?: string
  src?: string
  durationSeconds?: number
  trimStart?: number
  trimEnd?: number
}

export function parseDraggedClips(dt: DataTransfer): DraggedClip[] | null {
  const json = dt.getData(CLIP_MIME) || dt.getData("text/plain")
  if (!json) return null
  try {
    const raw = JSON.parse(json) as any
    const list = Array.isArray(raw?.clips) ? raw.clips : Array.isArray(raw) ? raw : null
    if (!list) return null
    const out: DraggedClip[] = []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const type = item.type === "video" || item.type === "audio" ? item.type : null
      const id = typeof item.id === "string" ? item.id : ""
      if (!type || !id) continue
      const segmentId = typeof item.segmentId === "string" ? item.segmentId : undefined
      const title = typeof item.title === "string" ? item.title : undefined
      const src = typeof item.src === "string" ? item.src : undefined
      const durationSeconds = typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds) ? item.durationSeconds : undefined
      const trimStart = typeof item.trimStart === "number" && Number.isFinite(item.trimStart) ? item.trimStart : undefined
      const trimEnd = typeof item.trimEnd === "number" && Number.isFinite(item.trimEnd) ? item.trimEnd : undefined
      out.push({ type, id, segmentId, title, src, durationSeconds, trimStart, trimEnd })
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

