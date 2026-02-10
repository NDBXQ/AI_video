import { readEnv, readEnvInt } from "@/shared/env"
import { ServiceError } from "@/server/shared/errors"

export type VibeLlmConfig = {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  topP: number
  maxCompletionTokens: number
  thinking: "auto" | "enabled" | "disabled"
}

export type VibeImageConfig = {
  size: string
  watermark: boolean
}

export type VibeVideoConfig = {
  watermark: boolean
  maxConcurrent: number
}

export const VIBE_VIDEO_DURATION_MIN_SECONDS = 4
export const VIBE_VIDEO_DURATION_MAX_SECONDS = 12

export function getVibeLlmConfig(): VibeLlmConfig {
  const apiKey = readEnv("VIBE_ARK_API_KEY")
  if (!apiKey) throw new ServiceError("ARK_NOT_CONFIGURED", "未配置火山方舟 API Key，请设置 VIBE_ARK_API_KEY")
  const baseUrl = readEnv("VIBE_ARK_API_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3"
  const model = readEnv("VIBE_ARK_LLM_MODEL") ?? "doubao-seed-1-8-251228"
  const temperature = Number(readEnv("VIBE_ARK_TEMPERATURE") ?? "0.7")
  const topP = Number(readEnv("VIBE_ARK_TOP_P") ?? "0.9")
  const maxCompletionTokens = readEnvInt("VIBE_ARK_MAX_COMPLETION_TOKENS") ?? 10000
  const thinkingRaw = String(readEnv("VIBE_ARK_THINKING") ?? "disabled").trim()
  const thinking = (() => {
    if (thinkingRaw === "auto" || thinkingRaw === "enabled" || thinkingRaw === "disabled") return thinkingRaw
    throw new ServiceError("VALIDATION_FAILED", `VIBE_ARK_THINKING 不合法：${thinkingRaw}（可选：auto/enabled/disabled）`)
  })()
  return { apiKey, baseUrl, model, temperature, topP, maxCompletionTokens, thinking }
}

export function getVibeImageConfig(): VibeImageConfig {
  const watermark = (readEnv("VIBE_IMAGE_WATERMARK") ?? "0").trim() === "1"
  const size = readEnv("VIBE_IMAGE_SIZE") ?? "2048x2048"
  return { size, watermark }
}

export function getVibeVideoConfig(): VibeVideoConfig {
  const watermark = (readEnv("VIBE_VIDEO_WATERMARK") ?? "0").trim() === "1"
  const maxConcurrent = readEnvInt("VIBE_VIDEO_MAX_CONCURRENT") ?? 2
  return { watermark, maxConcurrent }
}

export function getVibeSeedreamModel(usage: "reference_image" | "first_frame"): string {
  const configured = readEnv("VIBE_SEEDREAM_MODEL")
  if (configured) return configured
  if (usage === "reference_image") return "doubao-seedream-4-5-251128"
  return "doubao-seedream-4.5"
}

export function getVibeSeedanceModel(): string {
  return readEnv("VIBE_SEEDANCE_MODEL") ?? "doubao-seedance-1-5-pro-251215"
}
