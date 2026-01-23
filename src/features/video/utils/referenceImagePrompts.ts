import { extractVideoScript } from "./storyboardUtils"

export type ReferenceImagePrompt = {
  name: string
  prompt: string
  description?: string
  category: "background" | "role" | "item" | "reference"
}

function parseJsonMaybeTwice(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    const first = JSON.parse(value) as unknown
    if (typeof first === "string") {
      try {
        return JSON.parse(first) as unknown
      } catch {
        return first
      }
    }
    return first
  } catch {
    return null
  }
}

export function extractReferenceImagePrompts(scriptJson: unknown): ReferenceImagePrompt[] {
  const parsed = parseJsonMaybeTwice(scriptJson)
  if (!parsed || typeof parsed !== "object") return []

  const videoScript = extractVideoScript(parsed)
  const anyScript = (videoScript ?? parsed) as Record<string, unknown>
  const rawVideoContent = anyScript["video_content"]
  const videoContent = rawVideoContent && typeof rawVideoContent === "object" ? (rawVideoContent as Record<string, unknown>) : null
  if (!videoContent) return []

  const safeString = (v: unknown) => (typeof v === "string" ? v.trim() : "")

  const isNarrator = (name: string) => {
    const n = name.trim()
    if (!n) return false
    return n === "旁白" || n.toLowerCase() === "narrator"
  }

  const out: ReferenceImagePrompt[] = []

  const bg = videoContent["background"]
  if (bg && typeof bg === "object") {
    const anyBg = bg as Record<string, unknown>
    const desc = safeString(anyBg["description"])
    const name = safeString(anyBg["background_name"]) || safeString(anyBg["name"]) || "背景"
    if (desc) out.push({ name, prompt: desc, description: desc, category: "background" })
  }

  const roles = videoContent["roles"]
  if (Array.isArray(roles)) {
    roles
      .filter((r) => r && typeof r === "object")
      .forEach((r) => {
        const anyRole = r as Record<string, unknown>
        const desc = safeString(anyRole["description"])
        const name = safeString(anyRole["role_name"]) || safeString(anyRole["name"]) || "角色"
        if (isNarrator(name)) return
        if (desc) out.push({ name, prompt: desc, description: desc, category: "role" })
      })
  }

  const items = videoContent["items"]
  if (Array.isArray(items)) {
    items
      .filter((r) => r && typeof r === "object")
      .forEach((r) => {
        const anyItem = r as Record<string, unknown>
        const desc = safeString(anyItem["description"])
        const name = safeString(anyItem["item_name"]) || safeString(anyItem["name"]) || "物品"
        if (desc) out.push({ name, prompt: desc, description: desc, category: "item" })
      })
  }

  const otherItems = videoContent["other_items"]
  if (Array.isArray(otherItems)) {
    otherItems
      .filter((r) => r && typeof r === "object")
      .forEach((r) => {
        const anyItem = r as Record<string, unknown>
        const desc = safeString(anyItem["description"])
        const name = safeString(anyItem["item_name"]) || safeString(anyItem["name"]) || "物品"
        if (desc) out.push({ name, prompt: desc, description: desc, category: "item" })
      })
  }

  const uniq = new Map<string, ReferenceImagePrompt>()
  for (const p of out) {
    const key = `${p.category}::${p.name}`
    if (!uniq.has(key)) uniq.set(key, p)
  }
  return Array.from(uniq.values())
}
