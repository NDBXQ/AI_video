const SEEDREAM_SIZE_RATIO_TO_RESOLUTION: Record<string, string> = {
  "1:1": "2048x2048",
  "4:3": "2304x1728",
  "3:4": "1728x2304",
  "16:9": "2560x1440",
  "9:16": "1440x2560",
  "3:2": "2496x1664",
  "2:3": "1664x2496",
  "21:9": "3024x1296"
}

export const SEEDREAM_ALLOWED_SIZES = [
  "1:1",
  "2048x2048",
  "4:3",
  "2304x1728",
  "3:4",
  "1728x2304",
  "16:9",
  "2560x1440",
  "9:16",
  "1440x2560",
  "3:2",
  "2496x1664",
  "2:3",
  "1664x2496",
  "21:9",
  "3024x1296"
] as const

export function normalizeSeedreamSize(raw: string): { ok: true; size: string } | { ok: false; message: string } {
  const input = String(raw ?? "").trim()
  if (!input) return { ok: false, message: "size 不能为空" }
  const mapped = SEEDREAM_SIZE_RATIO_TO_RESOLUTION[input] ?? input
  if (!SEEDREAM_ALLOWED_SIZES.includes(input as any) && !SEEDREAM_ALLOWED_SIZES.includes(mapped as any)) {
    return { ok: false, message: `size 不合法：${input}` }
  }
  const m = /^(\d{3,5})x(\d{3,5})$/i.exec(mapped)
  if (!m) return { ok: false, message: `size 不合法：${input}` }
  const w = Math.trunc(Number(m[1]))
  const h = Math.trunc(Number(m[2]))
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { ok: false, message: `size 不合法：${input}` }
  const pixels = w * h
  const minPixels = 2560 * 1440
  const maxPixels = 4096 * 4096
  if (pixels < minPixels || pixels > maxPixels) return { ok: false, message: `size 超出像素范围：${mapped}` }
  return { ok: true, size: mapped }
}
