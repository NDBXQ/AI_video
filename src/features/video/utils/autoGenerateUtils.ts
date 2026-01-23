import { extractVideoScript } from "./storyboardUtils"

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function collectEntityNamesFromScriptData(
  scriptData: unknown,
  sets: { background: Set<string>; role: Set<string>; item: Set<string> }
): void {
  const videoScript = extractVideoScript(scriptData)
  if (!videoScript) return

  const anyVideoScript = videoScript as Record<string, unknown>
  const shotContent = anyVideoScript["shot_content"]
  const anyShotContent = shotContent && typeof shotContent === "object" ? (shotContent as Record<string, unknown>) : {}

  const background = anyShotContent["background"]
  const anyBackground = background && typeof background === "object" ? (background as Record<string, unknown>) : {}
  const bgName = normalizeName(anyBackground["background_name"])
  if (bgName) sets.background.add(bgName)

  const roles = anyShotContent["roles"]
  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (!r || typeof r !== "object") continue
      const anyRole = r as Record<string, unknown>
      const roleName = normalizeName(anyRole["role_name"])
      if (roleName) sets.role.add(roleName)
    }
  }

  const roleItems = anyShotContent["role_items"]
  if (Array.isArray(roleItems)) {
    for (const v of roleItems) {
      const name = normalizeName(v)
      if (name) sets.item.add(name)
    }
  }

  const otherItems = anyShotContent["other_items"]
  if (Array.isArray(otherItems)) {
    for (const v of otherItems) {
      const name = normalizeName(v)
      if (name) sets.item.add(name)
    }
  }
}

export function normalizeCategory(value: unknown): "background" | "role" | "item" {
  if (value === "role" || value === "item" || value === "background") return value
  return "background"
}

export function toEntityKey(category: "background" | "role" | "item", name: string): string {
  return `${category}::${name}`
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  const step = Math.max(1, Math.floor(size))
  for (let i = 0; i < arr.length; i += step) out.push(arr.slice(i, i + step))
  return out
}
