import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { updateStoryMetadata } from "@/server/domains/library/usecases/updateStoryMetadata"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const patchSchema = z.object({
  shortDrama: z.object({
    planningResult: z.any(),
    worldSetting: z.any(),
    characterSetting: z.any(),
    planningConfirmedAt: z.number().int().nonnegative().optional()
  })
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数不正确"), { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsedBody = patchSchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  try {
    const updated = await updateStoryMetadata({
      userId,
      storyId: parsedParams.data.id,
      patch: {
        shortDrama: parsedBody.data.shortDrama
      }
    })
    return NextResponse.json(makeApiOk(traceId, updated), { status: 200 })
  } catch (e) {
    const msg = String((e as any)?.message ?? "")
    if (msg === "STORY_NOT_FOUND") {
      return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "剧本不存在"), { status: 404 })
    }
    return NextResponse.json(makeApiErr(traceId, "UNKNOWN", "写入失败，请稍后重试"), { status: 500 })
  }
}
