import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { resolveTvcProjectAsset } from "@/server/domains/tvc/usecases/resolveAsset"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const querySchema = z.object({
  kind: z.enum(["reference_image", "first_frame", "video_clip", "user_image"]),
  index: z.coerce.number().int().min(0).max(1000000)
})

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const url = new URL(req.url)
  const rawQuery = Object.fromEntries(url.searchParams.entries())
  const parsedQuery = querySchema.safeParse(rawQuery)
  if (!parsedQuery.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  const res = await resolveTvcProjectAsset({ userId, storyId: parsedParams.data.id, kind: parsedQuery.data.kind, index: parsedQuery.data.index })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { url: res.url, ...(res.thumbnailUrl ? { thumbnailUrl: res.thumbnailUrl } : {}) }), { status: 200 })
}
