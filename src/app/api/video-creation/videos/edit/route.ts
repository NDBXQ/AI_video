import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { editVideoByConfig } from "@/server/domains/video-creation/usecases/videos/editVideo"

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

  const origin = req.nextUrl.origin
  const res = await editVideoByConfig({
    traceId,
    userId,
    storyId: parsed.data.storyId,
    origin,
    video_config_list: parsed.data.video_config_list,
    audio_config_list: parsed.data.audio_config_list
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { output_video_url: res.output_video_url, video_meta: res.video_meta ?? null }), { status: 200 })
}
