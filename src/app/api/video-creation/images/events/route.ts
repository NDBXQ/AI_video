import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { createVideoCreationImageEventsStream } from "@/server/domains/video-creation/usecases/images/imageEvents"

export const runtime = "nodejs"

const querySchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  includeGlobal: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v !== "false"),
  cursor: z.string().trim().optional()
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const res = await createVideoCreationImageEventsStream({
    traceId,
    userId,
    storyId: parsed.data.storyId,
    ...(parsed.data.storyboardId ? { storyboardId: parsed.data.storyboardId } : {}),
    includeGlobal: parsed.data.includeGlobal,
    ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
    req
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })

  return new Response(res.stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  })
}
