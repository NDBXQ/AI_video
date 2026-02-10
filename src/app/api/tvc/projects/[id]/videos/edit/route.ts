import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { logger } from "@/shared/logger"
import { editTvcProjectVideo } from "@/server/domains/tvc/usecases/videoEdit"

export const runtime = "nodejs"

const STABLE_PUBLIC_RESOURCE_PREFIX = "/api/library/public-resources/file/"
const STABLE_GENERATED_AUDIO_PREFIX = "/api/video-creation/audios/file/"

const urlSchema = z
  .string()
  .trim()
  .max(5_000)
  .refine((v) => v.startsWith("http") || v.startsWith(STABLE_PUBLIC_RESOURCE_PREFIX) || v.startsWith(STABLE_GENERATED_AUDIO_PREFIX), {
    message: "url 必须是 http(s) 或稳定资源路径"
  })

const videoItemSchema = z
  .object({
    url: urlSchema,
    start_time: z.number().min(0),
    end_time: z.number().min(0)
  })
  .refine((v) => v.end_time > v.start_time, { message: "video_config_list.end_time 必须大于 start_time" })

const audioItemSchema = z
  .object({
    url: urlSchema,
    start_time: z.number().min(0),
    end_time: z.number().min(0),
    timeline_start: z.number().min(0)
  })
  .refine((v) => v.end_time > v.start_time, { message: "audio_config_list.end_time 必须大于 start_time" })

const inputSchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  video_config_list: z.array(videoItemSchema).default([]),
  audio_config_list: z.array(audioItemSchema).default([])
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)

  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const storyId = (rawParams?.id ?? "").trim()
  if (!storyId) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const startedAt = performance.now()
  logger.info({
    event: "tvc_video_edit_start",
    module: "tvc",
    traceId,
    message: "开始请求 TVC 视频剪辑合成",
    userId,
    videoClips: parsed.data.video_config_list.length,
    audioClips: parsed.data.audio_config_list.length
  })

  const origin = req.nextUrl.origin
  const res = await editTvcProjectVideo({
    traceId,
    userId,
    storyId,
    origin,
    video_config_list: parsed.data.video_config_list,
    audio_config_list: parsed.data.audio_config_list
  })
  if (!res.ok) {
    logger.warn({
      event: "tvc_video_edit_failed",
      module: "tvc",
      traceId,
      message: "TVC 视频剪辑合成失败",
      durationMs: Math.round(performance.now() - startedAt),
      code: res.code
    })
    return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  }
  return NextResponse.json(makeApiOk(traceId, { finalVideoUrl: res.finalVideoUrl }), { status: 200 })
}
