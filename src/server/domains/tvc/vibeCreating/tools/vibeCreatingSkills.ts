import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { ServiceError } from "@/server/shared/errors"

async function resolveSkillFilePath(name: string): Promise<string> {
  return path.join(process.cwd(), "src", "server", "domains", "tvc", "vibeCreating", "skills", name, "SKILL.md")
}

function getCache(): Map<string, string> {
  const g = globalThis as any
  if (!g.__vibe_skill_cache) g.__vibe_skill_cache = new Map<string, string>()
  return g.__vibe_skill_cache as Map<string, string>
}

export async function loadSkillInstructions(skillName: string): Promise<string> {
  const name = (skillName ?? "").trim()
  if (!name) throw new ServiceError("SKILL_NOT_FOUND", "Skill 名称为空")
  const cache = getCache()
  const cached = cache.get(name)
  const filePath = await resolveSkillFilePath(name)
  const isProd = process.env.NODE_ENV === "production"
  if (cached) {
    if (isProd) return cached
    try {
      const s = await stat(filePath)
      const meta = JSON.parse(cached) as { __type?: string; mtimeMs?: number; content?: string }
      if (meta?.__type === "vibe_skill_cache_v1" && typeof meta.content === "string" && meta.mtimeMs === s.mtimeMs) {
        return meta.content
      }
    } catch {
    }
  }

  const raw = await readFile(filePath, "utf8").catch(() => null)
  if (!raw) throw new ServiceError("SKILL_NOT_FOUND", `Skill 不存在：${name}`)
  const trimmed = raw.trim()
  if (isProd) {
    cache.set(name, trimmed)
    return trimmed
  }
  try {
    const s = await stat(filePath)
    cache.set(name, JSON.stringify({ __type: "vibe_skill_cache_v1", mtimeMs: s.mtimeMs, content: trimmed }))
  } catch {
    cache.set(name, trimmed)
  }
  return trimmed
}
