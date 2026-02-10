import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const skillsRoot = path.resolve(repoRoot, "src/server/domains/tvc/vibeCreating/skills")

const KNOWN_TOOLS = new Set([
  "load_skill_instructions",
  "generate_images_batch",
  "assets_resolve",
  "assets_delete",
  "generate_videos_batch",
  "generate_videos_from_images_batch",
  "recommend_background_music",
  "compile_video_with_music"
])

function extractFrontmatter(raw) {
  const text = String(raw ?? "")
  if (!text.startsWith("---")) return null
  const end = text.indexOf("\n---", 3)
  if (end < 0) return null
  return text.slice(3, end).trim()
}

function parseFrontmatterName(fm) {
  const lines = String(fm ?? "").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const m = /^name:\s*(.+)\s*$/.exec(trimmed)
    if (m) return String(m[1] ?? "").trim().replace(/^["']|["']$/g, "")
  }
  return ""
}

function parseFrontmatterAllowedTools(fm) {
  const lines = String(fm ?? "").split("\n")
  let inAllowed = false
  const out = []
  for (const line of lines) {
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

async function main() {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  const problems = []

  for (const dir of dirs) {
    const skillPath = path.resolve(skillsRoot, dir, "SKILL.md")
    const raw = await fs.readFile(skillPath, "utf8").catch(() => null)
    if (!raw) {
      problems.push(`missing SKILL.md: ${skillPath}`)
      continue
    }
    const fm = extractFrontmatter(raw)
    if (!fm) {
      problems.push(`missing frontmatter: ${skillPath}`)
      continue
    }
    const name = parseFrontmatterName(fm)
    if (name && name !== dir) {
      problems.push(`frontmatter name mismatch: ${dir} vs ${name} (${skillPath})`)
    }
    const allowed = parseFrontmatterAllowedTools(fm)
    for (const t of allowed) {
      if (!KNOWN_TOOLS.has(t)) problems.push(`unknown tool "${t}" in ${skillPath}`)
    }
  }

  if (problems.length) {
    process.stderr.write(`skill-allowed-tools.guard: FAIL\n${problems.map((p) => `- ${p}`).join("\n")}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write("skill-allowed-tools.guard: OK\n")
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`)
  process.exitCode = 1
})
