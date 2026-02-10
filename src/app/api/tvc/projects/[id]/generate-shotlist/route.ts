import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generateTvcProjectShotlist } from "@/server/domains/tvc/usecases/generateShotlist"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const bodySchema = z.object({
  brief: z.string().trim().min(1).max(50_000),
  durationSec: z.number().int().min(5).max(120).optional(),
  aspectRatio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(50).optional()
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const brief = parsed.data.brief.trim()
  const durationSec = parsed.data.durationSec ?? 30
  const aspectRatio = parsed.data.aspectRatio?.trim()
  const resolution = parsed.data.resolution?.trim()
  const res = await generateTvcProjectShotlist({
    traceId,
    userId,
    storyId: parsedParams.data.id,
    brief,
    durationSec,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(resolution ? { resolution } : {})
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })

  return NextResponse.json(makeApiOk(traceId, { jobId: res.jobId, status: res.status }), { status: res.httpStatus })
}
