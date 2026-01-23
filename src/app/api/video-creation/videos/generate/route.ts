import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { VideoGenerationService } from "@/server/services/videoGenerationService"
import { ServiceError } from "@/server/services/errors"

const inputSchema = z.object({
  storyboardId: z.string().trim().min(1).max(200).optional(),
  storyId: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1).max(20_000),
  mode: z.string().trim().min(1).max(50),
  ratio: z.string().trim().min(1).max(20),
  duration: z.number().int().min(1).max(60),
  generate_audio: z.boolean().optional(),
  return_last_frame: z.boolean().optional(),
  watermark: z.boolean(),
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
    .optional(),
  forceRegenerate: z.boolean().optional(),
  async: z.boolean().optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)

  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  try {
    const normalized = {
      ...parsed.data,
      first_image: parsed.data.first_image ?? parsed.data.image
    }
    if (!normalized.first_image) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少首帧图片 first_image"), { status: 400 })

    const result = await VideoGenerationService.generateVideo(userId, normalized as any, traceId)

    if (result.async) {
      return NextResponse.json(makeApiOk(traceId, { jobId: result.jobId, status: result.status }), { status: 202 })
    }

    return NextResponse.json(
      makeApiOk(traceId, {
        storyId: result.storyId,
        storyboardId: result.storyboardId,
        video: result.video
      }),
      { status: 200 }
    )
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "STORYBOARD_NOT_FOUND" || err.code === "STORY_NOT_FOUND") status = 404
      if (err.code === "COZE_REQUEST_FAILED" || err.code === "COZE_NO_VIDEO_URL" || err.code === "VIDEO_DOWNLOAD_FAILED") status = 502

      return NextResponse.json(makeApiErr(traceId, err.code, err.message), { status })
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    return NextResponse.json(makeApiErr(traceId, "VIDEO_GENERATE_FAILED", anyErr?.message || "生成视频失败"), { status: 500 })
  }
}
