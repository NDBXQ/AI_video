import { VideoGenerationService } from "@/server/domains/video-creation/services/videoGenerationService"
import { ServiceError } from "@/server/shared/errors"

type ImageRef = { url: string; file_type: string }

type Input = {
  storyboardId?: string
  storyId?: string
  prompt: string
  mode: string
  ratio: string
  duration: number
  generate_audio?: boolean
  return_last_frame?: boolean
  watermark: boolean
  resolution?: unknown
  first_image?: ImageRef
  last_image?: ImageRef
  image?: ImageRef
  forceRegenerate?: boolean
  async?: boolean
}

export async function generateVideoCreationVideo(input: {
  traceId: string
  userId: string
  payload: Input
}): Promise<
  | { ok: true; status: 200 | 202; data: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    const normalized = { ...input.payload, first_image: input.payload.first_image ?? input.payload.image }
    if (!normalized.first_image) return { ok: false, code: "VALIDATION_FAILED", message: "缺少首帧图片 first_image", status: 400 }

    const result = await VideoGenerationService.generateVideo(input.userId, normalized as any, input.traceId)
    if ((result as any)?.async) {
      return { ok: true, status: 202, data: { jobId: (result as any).jobId, status: (result as any).status } }
    }
    return {
      ok: true,
      status: 200,
      data: {
        storyId: (result as any).storyId,
        storyboardId: (result as any).storyboardId,
        video: (result as any).video
      }
    }
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "STORYBOARD_NOT_FOUND" || err.code === "STORY_NOT_FOUND") status = 404
      if (err.code === "COZE_REQUEST_FAILED" || err.code === "COZE_NO_VIDEO_URL" || err.code === "VIDEO_DOWNLOAD_FAILED") status = 502
      return { ok: false, code: err.code, message: err.message, status }
    }
    const anyErr = err as { message?: string }
    return { ok: false, code: "VIDEO_GENERATE_FAILED", message: anyErr?.message || "生成视频失败", status: 500 }
  }
}
