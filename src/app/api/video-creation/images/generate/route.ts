import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { generateVideoCreationImages } from "@/server/domains/video-creation/usecases/images/generateImages"

const promptSchema = z.object({
  name: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(80_000),
  description: z.string().trim().max(10_000).optional(),
  category: z.enum(["background", "role", "item"]).default("background"),
  generatedImageId: z.string().trim().min(1).max(200).optional()
})

const inputSchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  prompts: z.array(promptSchema).min(1).max(50),
  forceRegenerate: z.boolean().default(false),
  async: z.boolean().default(false)
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
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  const res = await generateVideoCreationImages({ userId, traceId, payload: parsed.data })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, res.data), { status: res.status })
}
