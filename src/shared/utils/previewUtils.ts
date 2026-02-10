
export function createLocalPreviewSvg(title: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0f1620"/>
          <stop offset="1" stop-color="#0b0f14"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7b61ff"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <circle cx="980" cy="260" r="220" fill="url(#accent)" opacity="0.35"/>
      <circle cx="320" cy="520" r="260" fill="url(#accent)" opacity="0.20"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function uniqueStrings(values: string[]): string[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean))
  return Array.from(set)
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

