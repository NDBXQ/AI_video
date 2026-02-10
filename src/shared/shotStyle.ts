export type ShotStyleId = "realistic" | "anime" | "cinema" | "tv" | "short"

export function normalizeShotStyleId(value?: string | null): "realistic" | "anime" {
  const v = value?.trim()
  if (!v) return "realistic"
  if (v === "realistic" || v === "anime") return v
  if (v === "short") return "anime"
  return "realistic"
}

export function getShotStyleLabel(value?: string | null): string {
  const v = value?.trim()
  if (!v) return ""
  if (v === "anime" || v === "short") return "动漫风"
  if (v === "realistic" || v === "cinema" || v === "tv") return "真实风"
  return v
}
