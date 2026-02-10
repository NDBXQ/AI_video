import { ImageCompositionService } from "@/server/domains/video-creation/services/imageCompositionService"
import { ServiceError } from "@/server/shared/errors"

type ReferenceImage = { name: string; url: string }

export async function composeVideoCreationImage(input: {
  userId: string
  storyboardId: string
  traceId: string
  referenceImages?: ReferenceImage[]
}): Promise<
  | { ok: true; data: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    const result = await ImageCompositionService.composeImage(input.userId, input.storyboardId, input.traceId, input.referenceImages)
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "STORYBOARD_NOT_FOUND" || err.code === "PROMPT_NOT_FOUND" || err.code === "NO_REFERENCE_IMAGES") status = 400
      if (err.code === "COZE_REQUEST_FAILED" || err.code === "COZE_NO_IMAGE_URL") status = 502
      return { ok: false, code: err.code, message: err.message, status }
    }
    const anyErr = err as { message?: string }
    return { ok: false, code: "COMPOSE_FAILED", message: anyErr?.message || "图片合成失败", status: 500 }
  }
}

export async function composeVideoCreationTailImage(input: {
  userId: string
  storyboardId: string
  traceId: string
  referenceImages?: ReferenceImage[]
}): Promise<
  | { ok: true; data: unknown }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    const result = await ImageCompositionService.composeTailImage(input.userId, input.storyboardId, input.traceId, input.referenceImages)
    return { ok: true, data: result }
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "STORYBOARD_NOT_FOUND" || err.code === "PROMPT_NOT_FOUND" || err.code === "NO_REFERENCE_IMAGES") status = 400
      if (err.code === "COZE_REQUEST_FAILED" || err.code === "COZE_NO_IMAGE_URL") status = 502
      return { ok: false, code: err.code, message: err.message, status }
    }
    const anyErr = err as { message?: string }
    return { ok: false, code: "COMPOSE_FAILED", message: anyErr?.message || "图片合成失败", status: 500 }
  }
}
