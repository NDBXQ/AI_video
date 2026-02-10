import "server-only"

import { ChatOpenAI } from "@langchain/openai"
import { ServiceError } from "@/server/shared/errors"
import { readEnvInt } from "@/shared/env"

export function createArkChatModel(params: { traceId: string }): ChatOpenAI {
  const baseURL = process.env.VIBE_ARK_API_BASE_URL
  const apiKey = process.env.VIBE_ARK_API_KEY
  const model = process.env.VIBE_ARK_LLM_MODEL
  const temperatureRaw = process.env.VIBE_ARK_TEMPERATURE
  const timeout = readEnvInt("VIBE_ARK_TIMEOUT_MS") ?? readEnvInt("REQUEST_TIMEOUT_MS") ?? 900_000

  if (!baseURL || !apiKey || !model) {
    throw new ServiceError(
      "MISSING_LLM_CONFIG",
      "缺少 VIBE_ARK_API_BASE_URL / VIBE_ARK_API_KEY / VIBE_ARK_LLM_MODEL"
    )
  }

  const temperature = Number.isFinite(Number(temperatureRaw)) ? Number(temperatureRaw) : 0.7

  return new ChatOpenAI({
    model,
    apiKey,
    temperature,
    timeout,
    configuration: { baseURL, defaultHeaders: { "x-trace-id": params.traceId } } as any
  })
}
