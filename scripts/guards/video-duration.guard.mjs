import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")

async function readText(relativePath) {
  const abs = path.resolve(repoRoot, relativePath)
  return { abs, text: await fs.readFile(abs, "utf8") }
}

function assertMatch({ abs, text }, pattern, message) {
  if (!pattern.test(text)) {
    const hint = message ? `: ${message}` : ""
    throw new Error(`Guard failed${hint}\nFile: ${abs}\nPattern: ${String(pattern)}`)
  }
}

async function main() {
  const toolSpecFile = await readText("src/server/domains/tvc/vibeCreating/tools/toolSpecs.ts")
  assertMatch(
    toolSpecFile,
    /duration_seconds:\s*\{\s*type:\s*"number"[\s\S]*?minimum:\s*(?:4|VIBE_VIDEO_DURATION_MIN_SECONDS)[\s\S]*?maximum:\s*(?:12|VIBE_VIDEO_DURATION_MAX_SECONDS)/s,
    "tool schema 应声明 duration_seconds 的最小/最大值"
  )

  const toolExecutorFile = await readText("src/server/domains/tvc/vibeCreating/tools/toolExecutor.ts")
  assertMatch(toolExecutorFile, /Number\.isInteger\(durationSecondsRaw\)/, "tool 运行时应校验 duration_seconds 为整数")
  assertMatch(toolExecutorFile, /durationSecondsRaw\s*<\s*(?:4|VIBE_VIDEO_DURATION_MIN_SECONDS)/, "tool 运行时应校验 duration_seconds >= 4")
  assertMatch(toolExecutorFile, /durationSecondsRaw\s*>\s*(?:12|VIBE_VIDEO_DURATION_MAX_SECONDS)/, "tool 运行时应校验 duration_seconds <= 12")
  assertMatch(
    toolExecutorFile,
    /requests\[\]\.duration_seconds 必须为 (?:4|\$\{VIBE_VIDEO_DURATION_MIN_SECONDS\})~(?:12|\$\{VIBE_VIDEO_DURATION_MAX_SECONDS\}) 的整数/,
    "tool 运行时错误信息应包含 4~12 范围"
  )

  const usecaseFile = await readText("src/server/domains/tvc/vibeCreating/tooling/usecases/videos/generateVideosFromFirstFramesBatch.ts")
  assertMatch(usecaseFile, /durationSeconds\s*<\s*(?:4|VIBE_VIDEO_DURATION_MIN_SECONDS)/, "usecase 兜底应校验 durationSeconds >= 4")
  assertMatch(usecaseFile, /durationSeconds\s*>\s*(?:12|VIBE_VIDEO_DURATION_MAX_SECONDS)/, "usecase 兜底应校验 durationSeconds <= 12")
  assertMatch(
    usecaseFile,
    /requests\[\]\.duration_seconds 必须为 (?:4|\$\{VIBE_VIDEO_DURATION_MIN_SECONDS\})~(?:12|\$\{VIBE_VIDEO_DURATION_MAX_SECONDS\}) 的整数/,
    "usecase 错误信息应包含 4~12 范围"
  )

  process.stdout.write("video-duration.guard: OK\n")
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`)
  process.exitCode = 1
})
