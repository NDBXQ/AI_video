import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { stories, storyOutlines, storyboards } from "@/shared/schema"

const paramsSchema = z.object({
  outlineId: z.string().trim().min(1).max(200)
})

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ outlineId: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const raw = await params
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const db = await getDb({ stories, storyOutlines, storyboards })
  const rows = await db
    .select({ storyId: storyOutlines.storyId })
    .from(storyOutlines)
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyOutlines.id, parsed.data.outlineId), eq(stories.userId, userId)))
    .limit(1)

  const storyId = rows[0]?.storyId
  if (!storyId) return NextResponse.json(makeApiErr(traceId, "OUTLINE_NOT_FOUND", "大纲章节不存在"), { status: 404 })

  logger.info({
    event: "script_outline_delete_start",
    module: "script",
    traceId,
    message: "开始删除大纲章节",
    storyId,
    outlineId: parsed.data.outlineId
  })

  await db.delete(storyboards).where(eq(storyboards.outlineId, parsed.data.outlineId))
  await db.delete(storyOutlines).where(eq(storyOutlines.id, parsed.data.outlineId))

  const remaining = await db
    .select({ id: storyOutlines.id })
    .from(storyOutlines)
    .where(eq(storyOutlines.storyId, storyId))
    .orderBy(asc(storyOutlines.sequence), asc(storyOutlines.createdAt))

  for (let i = 0; i < remaining.length; i += 1) {
    const row = remaining[i]
    if (!row) continue
    await db.update(storyOutlines).set({ sequence: i + 1 }).where(eq(storyOutlines.id, row.id))
  }

  logger.info({
    event: "script_outline_delete_success",
    module: "script",
    traceId,
    message: "删除大纲章节成功",
    storyId,
    outlineId: parsed.data.outlineId,
    remainingCount: remaining.length
  })

  return NextResponse.json(makeApiOk(traceId, { deleted: true, storyId, outlineId: parsed.data.outlineId, remainingCount: remaining.length }), { status: 200 })
}

