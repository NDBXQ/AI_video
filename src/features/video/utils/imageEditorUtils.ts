export type NormalizedRect = { x: number; y: number; w: number; h: number }
export type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
export const clamp01 = (v: number) => clamp(v, 0, 1)

export const normalizeRect = (r: NormalizedRect): NormalizedRect => {
  const minSize = 0.02
  const w = Math.max(minSize, Math.min(1, r.w))
  const h = Math.max(minSize, Math.min(1, r.h))
  const x = clamp01(Math.min(r.x, 1 - w))
  const y = clamp01(Math.min(r.y, 1 - h))
  return { x, y, w, h }
}

export const applyResize = (handle: ResizeHandle, start: NormalizedRect, dx: number, dy: number): NormalizedRect => {
  const minSize = 0.02
  let x = start.x
  let y = start.y
  let w = start.w
  let h = start.h

  if (handle.includes("e")) w = start.w + dx
  if (handle.includes("s")) h = start.h + dy
  if (handle.includes("w")) {
    x = start.x + dx
    w = start.w - dx
  }
  if (handle.includes("n")) {
    y = start.y + dy
    h = start.h - dy
  }

  if (w < minSize) {
    if (handle.includes("w")) x = start.x + (start.w - minSize)
    w = minSize
  }
  if (h < minSize) {
    if (handle.includes("n")) y = start.y + (start.h - minSize)
    h = minSize
  }

  if (x < 0) {
    w = w + x
    x = 0
  }
  if (y < 0) {
    h = h + y
    y = 0
  }
  if (x + w > 1) {
    w = 1 - x
  }
  if (y + h > 1) {
    h = 1 - y
  }

  w = Math.max(minSize, w)
  h = Math.max(minSize, h)
  if (x + w > 1) x = 1 - w
  if (y + h > 1) y = 1 - h

  return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) }
}

export type ContainMetrics = {
  frameLeft: number
  frameTop: number
  fw: number
  fh: number
  ox: number
  oy: number
  dw: number
  dh: number
}

export const calculateContainMetrics = (
  imageSize: { width: number; height: number } | null,
  frameRect: { left: number; top: number; width: number; height: number } | null
): ContainMetrics | null => {
  if (!imageSize || !frameRect) return null
  const { width: fw, height: fh, left: frameLeft, top: frameTop } = frameRect
  if (fw <= 0 || fh <= 0) return null
  const iw = imageSize.width
  const ih = imageSize.height
  if (iw <= 0 || ih <= 0) return null

  const scale = Math.min(fw / iw, fh / ih)
  const dw = iw * scale
  const dh = ih * scale
  const ox = (fw - dw) / 2
  const oy = (fh - dh) / 2
  return { frameLeft, frameTop, fw, fh, ox, oy, dw, dh }
}

export const rectToStyle = (r: NormalizedRect | null, metrics: ContainMetrics | null) => {
  if (!r || !metrics) return null
  const left = metrics.ox + r.x * metrics.dw
  const top = metrics.oy + r.y * metrics.dh
  const width = r.w * metrics.dw
  const height = r.h * metrics.dh
  return { left, top, width, height }
}
