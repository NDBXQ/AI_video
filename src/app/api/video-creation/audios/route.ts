import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { listVideoCreationAudios } from "@/server/domains/video-creation/usecases/audios/listAudios"

const querySchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    storyboardId: url.searchParams.get("storyboardId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyboardId, limit, offset } = parsed.data
  const res = await listVideoCreationAudios({ userId, storyboardId, limit, offset })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { storyboardId: res.storyboardId, items: res.items, limit: res.limit, offset: res.offset }), { status: 200 })
}
