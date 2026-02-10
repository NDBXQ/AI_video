import "server-only"

import { z } from "zod"
import { readEnv, readEnvInt } from "@/shared/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { ServiceError } from "@/server/shared/errors"

const ttsResponseSchema = z.object({
  audio_url: z.string().trim().url().max(10_000),
  audio_size: z.number().int().min(0).max(500_000_000)
})

export class CozeTtsClient {
  static async synthesize(params: { text: string; speaker: string; traceId: string }): Promise<{ audioUrl: string; audioSize: number }> {
    const token = readEnv("TTS_API_TOKEN")
    const url = readEnv("TTS_API_URL") ?? "https://22y3kz7f82.coze.site/run"
    if (!token) throw new ServiceError("COZE_NOT_CONFIGURED", "Coze 未配置，请设置 TTS_API_TOKEN（URL 可选）")

    const timeoutMs = readEnvInt("COZE_TTS_REQUEST_TIMEOUT_MS") ?? (readEnvInt("REQUEST_TIMEOUT_MS") ?? 120_000)

    try {
      const coze = await callCozeRunEndpoint({
        traceId: params.traceId,
        url,
        token,
        timeoutMs,
        module: "tts",
        body: { text: params.text, speaker: params.speaker }
      })

      const parsed = ttsResponseSchema.safeParse(coze.data)
      if (!parsed.success) throw new ServiceError("TTS_INVALID_RESPONSE", "TTS 返回格式不正确")
      return { audioUrl: parsed.data.audio_url, audioSize: parsed.data.audio_size }
    } catch (err) {
      if (err instanceof CozeRunEndpointError) throw new ServiceError("COZE_REQUEST_FAILED", "Coze 调用失败，请稍后重试")
      throw err
    }
  }
}
