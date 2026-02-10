import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { listTvcProjectAssets } from "@/server/domains/tvc/usecases/assets"
import { deleteTvcProjectAsset } from "@/server/domains/tvc/usecases/deleteAsset"
 
export const runtime = "nodejs"
 
const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})
 
const querySchema = z.object({
  cursor: z.string().trim().optional()
})

const deleteBodySchema = z.object({
  kind: z.enum(["reference_image", "first_frame", "video_clip"]),
  ordinal: z.number().int().min(1).max(10_000)
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
 
  const storyId = parsedParams.data.id
  const res = await listTvcProjectAssets({ userId, storyId, cursor: parsedQuery.data.cursor })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在"), { status: 404 })
  return NextResponse.json(makeApiOk(traceId, { items: res.items, cursor: res.cursor }), { status: 200 })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsedBody = deleteBodySchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  try {
    const res = await deleteTvcProjectAsset({
      userId,
      storyId: parsedParams.data.id,
      kind: parsedBody.data.kind,
      ordinal: parsedBody.data.ordinal,
      traceId
    })
    if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
    return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
  } catch (err) {
    const msg = String((err as any)?.message ?? "删除失败")
    return NextResponse.json(makeApiErr(traceId, "DELETE_FAILED", msg), { status: 500 })
  }
}
