import "server-only"

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { ServiceError } from "@/server/shared/errors"

export type AgentSkillMetadata = {
  name: string
  description: string
  directory: string
}

const skillsRoot = path.join(process.cwd(), "src", "server", "agent", "skills")

function extractFrontmatter(raw: string): string | null {
  const text = String(raw ?? "")
  if (!text.startsWith("---")) return null
  const end = text.indexOf("\n---", 3)
  if (end < 0) return null
  return text.slice(3, end).trim()
}

function parseFrontmatterKey(fm: string, key: string): string {
  const lines = String(fm ?? "").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const m = new RegExp(`^${key}:\\s*(.+)\\s*$`).exec(trimmed)
    if (!m) continue
    return String(m[1] ?? "").trim().replace(/^["']|["']$/g, "")
  }
  return ""
}

export async function discoverAgentSkills(): Promise<AgentSkillMetadata[]> {
  const entries = await readdir(skillsRoot, { withFileTypes: true }).catch(() => [])
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()

  const out: AgentSkillMetadata[] = []
  for (const dir of dirs) {
    const filePath = path.join(skillsRoot, dir, "SKILL.md")
    const raw = await readFile(filePath, "utf8").catch(() => null)
    if (!raw) continue
    const fm = extractFrontmatter(raw)
    if (!fm) continue
    const name = parseFrontmatterKey(fm, "name") || dir
    const description = parseFrontmatterKey(fm, "description")
    out.push({
      name,
      description,
      directory: path.join(skillsRoot, dir)
    })
  }
  return out
}

export async function loadAgentSkillMarkdown(skillName: string): Promise<{ content: string; directory: string }> {
  const name = (skillName ?? "").trim()
  if (!name) throw new ServiceError("SKILL_NOT_FOUND", "Skill 名称为空")
  const filePath = path.join(skillsRoot, name, "SKILL.md")
  const raw = await readFile(filePath, "utf8").catch(() => null)
  if (!raw) throw new ServiceError("SKILL_NOT_FOUND", `Skill 不存在：${name}`)
  return { content: raw.trim(), directory: path.join(skillsRoot, name) }
}

