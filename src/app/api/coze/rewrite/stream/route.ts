import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { CozeRewriteService } from "@/server/services/cozeRewriteService"
import { ServiceError } from "@/server/services/errors"

const inputSchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  outlineSequence: z.number().int().min(1).max(10_000),
  modification_requirements: z.string().min(1).max(20_000)
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)

  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "COZE_INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), { status: 400 })
  }

  try {
    const stream = await CozeRewriteService.createStream({
      traceId,
      userId,
      storyId: parsed.data.storyId,
      outlineSequence: parsed.data.outlineSequence,
      modificationRequirements: parsed.data.modification_requirements
    })

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      // 映射 ServiceError 到 HTTP 状态码
      let status = 500
      if (err.code === "STORY_NOT_FOUND" || err.code === "OUTLINE_NOT_FOUND") status = 404
      if (err.code === "FORBIDDEN") status = 403
      // 其他错误默认 500

      return NextResponse.json(makeApiErr(traceId, err.code, err.message), { status })
    }

    // 未知错误
    const anyErr = err as { message?: string }
    return NextResponse.json(makeApiErr(traceId, "INTERNAL_ERROR", anyErr.message ?? "内部错误"), { status: 500 })
  }
}
