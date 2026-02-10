import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTvcProjectTimeline, persistTvcProjectTimeline } from "@/server/domains/tvc/usecases/timeline"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const timelineSchema = z
  .object({
    version: z.number().int().min(1).max(100).default(1),
    videoClips: z.array(z.any()).default([]),
    audioClips: z.array(z.any()).default([])
  })
  .passthrough()

const putSchema = z.object({
  timeline: timelineSchema
})

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const storyId = parsedParams.data.id
  const res = await getTvcProjectTimeline({ userId, storyId })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在"), { status: 404 })

  return NextResponse.json(makeApiOk(traceId, { storyId, timeline: res.timeline ?? null }), { status: 200 })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsedBody = putSchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const storyId = parsedParams.data.id
  const res = await persistTvcProjectTimeline({ userId, storyId, timeline: parsedBody.data.timeline })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在"), { status: 404 })

  return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
}

