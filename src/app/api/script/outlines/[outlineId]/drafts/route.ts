import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { stories, storyOutlines } from "@/shared/schema"

const paramsSchema = z.object({
  outlineId: z.string().trim().min(1).max(200)
})

const bodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().min(1).max(200_000),
  requirements: z.string().trim().min(1).max(10_000).optional()
})

function safeJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ outlineId: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  let rawBody: unknown = null
  try {
    rawBody = await req.json()
  } catch {
    rawBody = null
  }
  const parsedBody = bodySchema.safeParse(rawBody)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "请求体格式不正确"), { status: 400 })

  const db = await getDb({ stories, storyOutlines })
  const rows = await db
    .select({
      outlineId: storyOutlines.id,
      storyId: storyOutlines.storyId,
      outlineDrafts: storyOutlines.outlineDrafts
    })
    .from(storyOutlines)
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyOutlines.id, parsedParams.data.outlineId), eq(stories.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) return NextResponse.json(makeApiErr(traceId, "OUTLINE_NOT_FOUND", "大纲章节不存在"), { status: 404 })

  const draftId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const nextDraft = {
    id: draftId,
    title: parsedBody.data.title ?? null,
    content: parsedBody.data.content,
    requirements: parsedBody.data.requirements ?? null,
    createdAt
  }
  const prevDrafts = safeJsonArray(row.outlineDrafts)
  const nextDrafts = [...prevDrafts, nextDraft]

  logger.info({
    event: "script_outline_draft_create_start",
    module: "script",
    traceId,
    message: "开始保存大纲章节改写版本",
    storyId: row.storyId,
    outlineId: row.outlineId
  })

  await db
    .update(storyOutlines)
    .set({
      outlineDrafts: nextDrafts as any,
      activeOutlineDraftId: draftId
    })
    .where(eq(storyOutlines.id, parsedParams.data.outlineId))

  const durationMs = Date.now() - start
  logger.info({
    event: "script_outline_draft_create_success",
    module: "script",
    traceId,
    message: "保存大纲章节改写版本成功",
    durationMs,
    storyId: row.storyId,
    outlineId: row.outlineId,
    draftId
  })

  return NextResponse.json(makeApiOk(traceId, { outlineId: row.outlineId, draft: nextDraft, activeDraftId: draftId }), { status: 200 })
}
