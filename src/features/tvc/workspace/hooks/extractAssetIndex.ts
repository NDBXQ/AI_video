export function extractAssetIndex(obj: unknown): number | null {
  if (!obj || typeof obj !== "object") return null
  const rec = obj as Record<string, unknown>
  const raw = rec["ordinal"] ?? rec["Ordinal"] ?? rec["index"] ?? rec["Index"] ?? rec["ID"] ?? rec["id"] ?? rec["Id"]
  const s = String(raw ?? "").trim()
  if (!s) return null
  const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
