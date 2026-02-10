import "server-only"

import { ChatOpenAI } from "@langchain/openai"
import { readEnvInt } from "@/shared/env"
import { getVibeLlmConfig } from "../../vibeCreatingConfig"

export function createVibeCreatingLangChainModel(traceId: string): ChatOpenAI {
  const llm = getVibeLlmConfig()
  const timeoutMs = readEnvInt("VIBE_TVC_LLM_TIMEOUT_MS") ?? readEnvInt("VIBE_TVC_AGENT_TIMEOUT_MS") ?? 900_000
  return new ChatOpenAI({
    model: llm.model,
    apiKey: llm.apiKey,
    temperature: llm.temperature,
    topP: llm.topP,
    maxTokens: typeof llm.maxCompletionTokens === "number" ? llm.maxCompletionTokens : undefined,
    timeout: timeoutMs,
    configuration: { baseURL: llm.baseUrl, defaultHeaders: { "x-trace-id": traceId } } as any
  })
}
