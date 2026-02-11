import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { stories } from "@/shared/schema"

export const runtime = "nodejs"

const postSchema = z.object({
  storyType: z.literal("brief"),
  title: z.string().trim().max(100).optional(),
  storyText: z.string().trim().min(1).max(50_000),
  ratio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(20).optional(),
  style: z.string().trim().max(50).optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const title = parsed.data.title?.trim() ? parsed.data.title.trim() : null
  const aspectRatio = parsed.data.ratio?.trim() || "16:9"
  const resolution = parsed.data.resolution?.trim() || "1080p"
  const shotStyle = parsed.data.style?.trim() || "realistic"

  try {
    const db = await getDb({ stories })
    const [row] = await db
      .insert(stories)
      .values({
        userId,
        title,
        storyType: "brief",
        resolution,
        aspectRatio,
        storyText: parsed.data.storyText,
        shotStyle,
        metadata: {}
      })
      .returning({ id: stories.id })
    const storyId = row?.id ?? ""
    if (!storyId) return NextResponse.json(makeApiErr(traceId, "UNKNOWN", "创建失败，请稍后重试"), { status: 500 })
    return NextResponse.json(makeApiOk(traceId, { storyId }), { status: 200 })
  } catch {
    return NextResponse.json(makeApiErr(traceId, "UNKNOWN", "创建失败，请稍后重试"), { status: 500 })
  }
}

