"use client"

export function collectUserProvidedImages(assets: unknown[]): Array<{ ordinal: number; url: string; thumbnailUrl?: string }> {
  if (!Array.isArray(assets) || assets.length === 0) return []
  const byOrdinal = new Map<number, { ordinal: number; url: string; thumbnailUrl?: string }>()
  for (const a of assets) {
    const rec = a as any
    const kind = String(rec?.kind ?? "").trim()
    const meta = (rec?.meta ?? {}) as any
    const isUserProvided = Boolean(rec?.isUserProvided) || kind === "user_image"
    if (!isUserProvided) continue
    if (kind !== "user_image" && kind !== "reference_image") continue
    const ordinal = Number.parseInt(String(rec?.ordinal ?? rec?.index ?? "").replace(/[^\d]/g, ""), 10)
    if (!Number.isFinite(ordinal) || ordinal <= 0) continue
    const url = String(rec?.url ?? "").trim()
    const thumbnailUrl = String(rec?.thumbnailUrl ?? "").trim()
    if (!url && !thumbnailUrl) continue
    byOrdinal.set(ordinal, { ordinal, url, ...(thumbnailUrl ? { thumbnailUrl } : {}) })
  }
  return Array.from(byOrdinal.values()).sort((x, y) => x.ordinal - y.ordinal)
}
