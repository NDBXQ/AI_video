import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { createTvcProject, listTvcProjects } from "@/server/domains/tvc/usecases"

export const runtime = "nodejs"

const createSchema = z.object({
  title: z.string().trim().max(100).optional(),
  brief: z.string().trim().max(50_000).optional(),
  durationSec: z.number().int().min(5).max(120).optional(),
  aspectRatio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(50).optional()
})

const listSchema = z.object({
  limit: z.string().trim().optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  const res = await createTvcProject({ userId, ...parsed.data })
  return NextResponse.json(makeApiOk(traceId, { project: res.project }), { status: 200 })
}

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  const limitRaw = Number(parsed.data.limit ?? "20")
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20
  const res = await listTvcProjects({ userId, limit })
  return NextResponse.json(makeApiOk(traceId, { projects: res.projects }), { status: 200 })
}
