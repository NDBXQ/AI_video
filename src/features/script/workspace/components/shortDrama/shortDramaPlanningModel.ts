export function cloneJson<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

export function unwrapPlanningResult(input: any): { wrapper: "wrapped" | "plain"; original: any; inner: any } {
  const original = input ?? null
  if (original && typeof original === "object" && "planning_result" in original) {
    const inner = (original as any).planning_result ?? null
    return { wrapper: "wrapped", original, inner }
  }
  return { wrapper: "plain", original, inner: original }
}

export function unwrapWorldSetting(input: any): { wrapper: "wrapped" | "plain"; original: any; inner: any } {
  const original = input ?? null
  if (original && typeof original === "object" && "world_setting" in original) {
    const inner = (original as any).world_setting ?? null
    return { wrapper: "wrapped", original, inner }
  }
  return { wrapper: "plain", original, inner: original }
}

export function unwrapCharacterSettings(input: any): { wrapper: "wrapped" | "plain"; original: any; inner: any } {
  const original = input ?? null
  if (original && typeof original === "object" && "character_settings" in original) {
    const inner = (original as any).character_settings ?? null
    return { wrapper: "wrapped", original, inner }
  }
  return { wrapper: "plain", original, inner: original }
}

export function toText(v: unknown): string {
  if (typeof v === "string") return v
  if (v == null) return ""
  return String(v)
}

export function toNum(v: unknown): number | "" {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return ""
}

export function sanitizeGenres(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  const cleaned = list.map((it) => String(it ?? "").trim()).filter(Boolean)
  return Array.from(new Set(cleaned)).slice(0, 50)
}
