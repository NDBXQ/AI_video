"use client"

import { buildAssetMetaKey } from "@/features/tvc/workspace/hooks/assetMetaKey"

export function applyAssetsToAssetUrlByKey(prev: Record<string, string>, assets: unknown[]): Record<string, string> {
  if (!Array.isArray(assets) || assets.length === 0) return prev
  const next: Record<string, string> = { ...prev }
  for (const a of assets) {
    const rec = a as any
    const kind = String(rec?.kind ?? "").trim()
    const ordinal = Number.parseInt(String(rec?.ordinal ?? rec?.index ?? "").replace(/[^\d]/g, ""), 10)
    const url = String(rec?.url ?? "").trim()
    const thumbnailUrl = String(rec?.thumbnailUrl ?? "").trim()
    if (!kind || !Number.isFinite(ordinal) || ordinal <= 0) continue
    const baseKey = `${kind}:${ordinal}`
    const nextBase = (thumbnailUrl || url).trim()
    if (nextBase && next[baseKey] !== nextBase) next[baseKey] = nextBase
    if (url && next[`${baseKey}:orig`] !== url) next[`${baseKey}:orig`] = url
    const meta = (rec?.meta ?? {}) as any
    if (kind === "reference_image") {
      const metaKey = buildAssetMetaKey(kind, [meta?.category ?? "", meta?.name ?? ""])
      if (nextBase && next[metaKey] !== nextBase) next[metaKey] = nextBase
      if (url && next[`${metaKey}:orig`] !== url) next[`${metaKey}:orig`] = url
    }
    if (kind === "first_frame") {
      const metaKey = buildAssetMetaKey(kind, [meta?.description ?? "", meta?.referenceImages ?? ""])
      if (nextBase && next[metaKey] !== nextBase) next[metaKey] = nextBase
      if (url && next[`${metaKey}:orig`] !== url) next[`${metaKey}:orig`] = url
    }
  }
  return next
}
