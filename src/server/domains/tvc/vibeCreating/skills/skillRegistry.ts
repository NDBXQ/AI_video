import { readFile } from "node:fs/promises"
import path from "node:path"
import { ServiceError } from "@/server/shared/errors"

export type VibeSkillRuntimePolicy = {
  name: string
  allowedTools: string[]
}

function getCache(): Map<string, VibeSkillRuntimePolicy> {
  const g = globalThis as any
  if (!g.__vibe_skill_policy_cache) g.__vibe_skill_policy_cache = new Map<string, VibeSkillRuntimePolicy>()
  return g.__vibe_skill_policy_cache as Map<string, VibeSkillRuntimePolicy>
}

function parseAllowedToolsFromFrontmatter(raw: string): string[] {
  const text = String(raw ?? "")
  if (!text.startsWith("---")) return []
  const end = text.indexOf("\n---", 3)
  if (end < 0) return []
  const fm = text.slice(3, end).split("\n")
  let inAllowed = false
  const out: string[] = []
  for (const line of fm) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isKey = /^[a-zA-Z0-9_]+:/.test(trimmed)
    if (isKey) {
      inAllowed = trimmed.startsWith("allowed_tools:")
      continue
    }
    if (inAllowed && trimmed.startsWith("-")) {
      const tool = trimmed.replace(/^-+/, "").trim()
      if (tool) out.push(tool)
    }
  }
  return Array.from(new Set(out))
}

function parseNameFromFrontmatter(raw: string): string {
  const text = String(raw ?? "")
  if (!text.startsWith("---")) return ""
  const end = text.indexOf("\n---", 3)
  if (end < 0) return ""
  const fm = text.slice(3, end).split("\n")
  for (const line of fm) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = /^name:\s*(.+)\s*$/.exec(trimmed)
    if (!m) continue
    const v = String(m[1] ?? "").trim()
    return v.replace(/^["']|["']$/g, "")
  }
  return ""
}

export async function getVibeSkillRuntimePolicy(skillName: string): Promise<VibeSkillRuntimePolicy> {
  const name = String(skillName ?? "").trim()
  if (!name) throw new ServiceError("SKILL_NOT_FOUND", "Skill 名称为空")
  const cache = getCache()
  const cached = cache.get(name)
  if (cached) return cached
  const filePath = path.join(process.cwd(), "src", "server", "domains", "tvc", "vibeCreating", "skills", name, "SKILL.md")
  const raw = await readFile(filePath, "utf8").catch(() => null)
  if (!raw) throw new ServiceError("SKILL_NOT_FOUND", `Skill 不存在：${name}`)
  const declaredName = parseNameFromFrontmatter(raw)
  if (declaredName && declaredName !== name) {
    throw new ServiceError("SKILL_INVALID", `Skill frontmatter.name 与目录名不一致：${declaredName} != ${name}`)
  }
  const allowedTools = parseAllowedToolsFromFrontmatter(raw)
  const policy: VibeSkillRuntimePolicy = { name, allowedTools }
  cache.set(name, policy)
  return policy
}
