import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk, type ApiErr, type ApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { stories } from "@/shared/schema"

const timelineSchema = z
  .object({
    version: z.number().int().min(1).max(100).default(1),
    videoClips: z.array(z.any()).default([]),
    audioClips: z.array(z.any()).default([])
  })
  .passthrough()

const putSchema = z.object({
  storyId: z.string().trim().min(1).max(200),
  timeline: timelineSchema
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const storyId = (url.searchParams.get("storyId") ?? "").trim()
  if (!storyId) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 storyId"), { status: 400 })

  const db = await getDb({ stories })
  const rows = await db
    .select({ metadata: stories.metadata })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
    .limit(1)

  if (rows.length === 0) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const metadata = (rows[0]?.metadata ?? {}) as any
  const timeline = metadata?.timeline ?? null
  return NextResponse.json(makeApiOk(traceId, { storyId, timeline }), { status: 200 })
}

export async function PUT(req: NextRequest): Promise<Response> {
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
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const db = await getDb({ stories })
  const rows = await db
    .select({ metadata: stories.metadata })
    .from(stories)
    .where(and(eq(stories.id, parsed.data.storyId), eq(stories.userId, userId)))
    .limit(1)
  if (rows.length === 0) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const prev = (rows[0]?.metadata ?? {}) as Record<string, unknown>
  const next = { ...prev, timeline: parsed.data.timeline } as any
  await db
    .update(stories)
    .set({ metadata: next, updatedAt: new Date() })
    .where(and(eq(stories.id, parsed.data.storyId), eq(stories.userId, userId)))

  const ok: ApiOk<{ storyId: string; timeline: unknown }> = makeApiOk(traceId, { storyId: parsed.data.storyId, timeline: parsed.data.timeline })
  return NextResponse.json(ok, { status: 200 })
}

