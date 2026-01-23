import { NextResponse } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { VideoGenerationService } from "@/server/services/videoGenerationService"
import { ServiceError } from "@/server/services/errors"

const inputSchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().min(1).max(20_000),
  mode: z.string().trim().min(1).max(50),
  ratio: z.string().trim().min(1).max(20),
  duration: z.number().int().min(1).max(60),
  watermark: z.boolean(),
  generate_audio: z.boolean().optional(),
  return_last_frame: z.boolean().optional(),
  resolution: z.string().trim().min(1).max(50).nullable().optional(),
  first_image: z
    .object({
      url: z.string().trim().url().max(5_000),
      file_type: z.string().trim().min(1).max(50)
    })
    .optional(),
  last_image: z
    .object({
      url: z.string().trim().url().max(5_000),
      file_type: z.string().trim().min(1).max(50)
    })
    .optional(),
  image: z
    .object({
      url: z.string().trim().url().max(5_000),
      file_type: z.string().trim().min(1).max(50)
    })
    .optional()
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)

  logger.info({
    event: "coze_video_generate_start",
    module: "coze",
    traceId,
    message: "开始生成视频"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "COZE_INVALID_JSON", "请求体不是合法 JSON"), {
      status: 400
    })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) {
    logger.warn({
      event: "coze_video_generate_validation_failed",
      module: "coze",
      traceId,
      message: "视频生成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  try {
    const normalized = { ...parsed.data, first_image: parsed.data.first_image ?? parsed.data.image }
    if (!normalized.first_image) {
      return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "缺少首帧图片 first_image"), { status: 400 })
    }
    const result = await VideoGenerationService.generateVideoDirect(normalized as any, traceId)
    
    return NextResponse.json(
      makeApiOk(traceId, result),
      { status: 200 }
    )
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === "COZE_REQUEST_FAILED" ? 502 : 500
      return NextResponse.json(makeApiErr(traceId, err.code, err.message), { status })
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "coze_video_generate_error",
      module: "coze",
      traceId,
      message: "视频生成异常",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    return NextResponse.json(makeApiErr(traceId, "COZE_UNKNOWN", "生成失败，请稍后重试"), {
      status: 500
    })
  }
}
