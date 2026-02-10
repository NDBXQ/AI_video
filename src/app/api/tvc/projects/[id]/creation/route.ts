import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTvcProjectCreation, persistTvcProjectMessages } from "@/server/domains/tvc/usecases/creation"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const postSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(200_000)
      })
    )
    .optional()
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
  const res = await getTvcProjectCreation({ userId, storyId })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在"), { status: 404 })
  return NextResponse.json(makeApiOk(traceId, { messages: res.messages ?? [], assets: res.assets ?? [] }), { status: 200 })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsedBody = postSchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const storyId = parsedParams.data.id
  const messages = parsedBody.data.messages ?? []
  const res = await persistTvcProjectMessages({ traceId, userId, storyId, messages })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在"), { status: 404 })

  return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
}
