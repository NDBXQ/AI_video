import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { ImageCompositionService } from "@/server/services/imageCompositionService"
import { ServiceError } from "@/server/services/errors"

const inputSchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  referenceImages: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        url: z.string().trim().min(1).max(4000)
      })
    )
    .optional()
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
    const { storyboardId } = parsed.data
    const result = await ImageCompositionService.composeImage(userId, storyboardId, traceId, parsed.data.referenceImages)

    return NextResponse.json(
      makeApiOk(traceId, result),
      { status: 200 }
    )
  } catch (err) {
    if (err instanceof ServiceError) {
      let status = 500
      if (err.code === "STORYBOARD_NOT_FOUND" || err.code === "PROMPT_NOT_FOUND" || err.code === "NO_REFERENCE_IMAGES") status = 400
      if (err.code === "COZE_REQUEST_FAILED" || err.code === "COZE_NO_IMAGE_URL") status = 502
      
      return NextResponse.json(makeApiErr(traceId, err.code, err.message), { status })
    }

    const anyErr = err as { message?: string }
    return NextResponse.json(makeApiErr(traceId, "COMPOSE_FAILED", anyErr?.message || "图片合成失败"), { status: 500 })
  }
}
