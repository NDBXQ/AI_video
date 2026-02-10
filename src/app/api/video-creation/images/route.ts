import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { listVideoCreationImages } from "@/server/domains/video-creation/usecases/images/listImages"

const querySchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  storyboardIds: z.string().trim().min(1).max(4000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  includeGlobal: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
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
    storyId: url.searchParams.get("storyId") ?? undefined,
    storyboardId: url.searchParams.get("storyboardId") ?? undefined,
    storyboardIds: url.searchParams.get("storyboardIds") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    includeGlobal: url.searchParams.get("includeGlobal") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyId: rawStoryId, storyboardId, storyboardIds, category, includeGlobal, limit, offset } = parsed.data
  if (!rawStoryId && !storyboardId && !storyboardIds) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "必须提供 storyId 或 storyboardId"), { status: 400 })
  }
  const res = await listVideoCreationImages({
    userId,
    storyId: rawStoryId ?? undefined,
    storyboardId: storyboardId ?? undefined,
    storyboardIds: storyboardIds ?? undefined,
    category: category ?? undefined,
    includeGlobal,
    limit,
    offset
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { storyId: res.storyId, items: res.items, limit: res.limit, offset: res.offset }), { status: 200 })
}
