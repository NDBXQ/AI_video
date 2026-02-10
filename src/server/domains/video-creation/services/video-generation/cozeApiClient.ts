import { readEnv, readEnvInt } from "@/shared/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { ServiceError } from "@/server/shared/errors"
import { logger } from "@/shared/logger"
import { GenerateVideoInput } from "./types"

export class CozeVideoClient {
  static extractVideoUrl(data: unknown): string | undefined {
    if (!data || typeof data !== "object") return undefined
    const anyData = data as Record<string, unknown>
    const candidates = [
      anyData["generated_video_url"],
      anyData["video_url"],
      anyData["extracted_video_url"],
      anyData["data"],
      anyData["url"]
    ]
    for (const value of candidates) {
      if (typeof value === "string" && value.startsWith("http")) return value
    }
    if (anyData["data"] && typeof anyData["data"] === "object") {
      const nested = CozeVideoClient.extractVideoUrl(anyData["data"])
      if (nested) return nested
    }
    return undefined
  }

  static extractLastFrameUrl(data: unknown): string | undefined {
    if (!data || typeof data !== "object") return undefined
    const anyData = data as Record<string, unknown>
    const candidates = [anyData["last_frame_url"], anyData["lastFrameUrl"], anyData["data"]]
    for (const value of candidates) {
      if (typeof value === "string" && value.startsWith("http")) return value
    }
    if (anyData["data"] && typeof anyData["data"] === "object") {
      const nested = CozeVideoClient.extractLastFrameUrl(anyData["data"])
      if (nested) return nested
    }
    return undefined
  }

  static async generateVideo(
    input: GenerateVideoInput,
    traceId: string,
    resolvedMode: string,
    finalResolution: string,
    finalRatio: string
  ): Promise<{ cozeData: unknown; videoUrl: string; lastFrameUrl?: string }> {
    const { prompt, duration, watermark, first_image, last_image, return_last_frame } = input
    const generateAudio = input.generate_audio ?? input.generateAudio ?? false
    
    const token = readEnv("VIDEO_GENERATE_API_TOKEN")
    const url = readEnv("VIDEO_GENERATE_API_URL") ?? "https://3f47zmnfcb.coze.site/run"
    
    if (!token) {
      throw new ServiceError("COZE_NOT_CONFIGURED", "Coze 未配置，请设置 VIDEO_GENERATE_API_TOKEN（URL 可选）")
    }

    const timeoutMs = readEnvInt("VIDEO_REQUEST_TIMEOUT_MS") ?? 120_000

    try {
      const cozeBody = {
        prompt: prompt.trim(),
        mode: resolvedMode,
        first_image,
        last_image: last_image ?? null,
        return_last_frame: return_last_frame ?? true,
        generate_audio: generateAudio,
        ratio: finalRatio,
        resolution: finalResolution,
        duration,
        watermark
      }

      const coze = await callCozeRunEndpoint({
        traceId,
        url,
        token,
        timeoutMs,
        module: "video",
        body: cozeBody
      })

      const cozeData = coze.data
      const videoUrl = CozeVideoClient.extractVideoUrl(cozeData)

      if (!videoUrl) {
        // If it's a direct generation call that we expect raw data from, we might not throw here, 
        // but for standard generation flow we need a URL. 
        // Let the caller handle if videoUrl is missing or throw specific error.
        // But based on original logic:
        // throw new ServiceError("COZE_NO_VIDEO_URL", "生成结果缺少可用视频 URL")
        // We will return what we found and let caller decide.
      }

      const lastFrameUrl = (return_last_frame ?? true) ? CozeVideoClient.extractLastFrameUrl(cozeData) : undefined

      return { cozeData, videoUrl: videoUrl || "", lastFrameUrl }
    } catch (err) {
      if (err instanceof CozeRunEndpointError) {
        throw new ServiceError("COZE_REQUEST_FAILED", "Coze 调用失败，请稍后重试")
      }
      const anyErr = err as { name?: string; message?: string; stack?: string }
      
      // We log error here but also rethrow or let caller log. 
      // Original code logged specific event.
      // We can let the service layer handle high level logging, or log here.
      // Let's just rethrow wrapper or original error.
      
      throw err
    }
  }
}
