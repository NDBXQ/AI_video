import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { generateVideoCreationVideo } from "@/server/domains/video-creation/usecases/videos/generateVideo"

const inputSchema = z.object({
  storyboardId: z.string().trim().min(1).max(200).optional(),
  storyId: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1).max(20_000),
  mode: z.string().trim().min(1).max(50),
  ratio: z.string().trim().min(1).max(20).default("adaptive"),
  duration: z.number().int().min(1).max(60),
  generate_audio: z.boolean().optional(),
  return_last_frame: z.boolean().optional(),
  watermark: z.boolean(),
  resolution: z.unknown().optional(),
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

  const res = await generateVideoCreationVideo({ traceId, userId, payload: parsed.data })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, res.data), { status: res.status })
}
