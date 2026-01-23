import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { storyboards } from "@/shared/schema"
import { getTraceId } from "@/shared/trace"

const querySchema = z.object({
  storyboardId: z.string().trim().min(1).max(200)
})

export async function GET(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ storyboardId: url.searchParams.get("storyboardId") ?? "" })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  try {
    const db = await getDb({ storyboards })
    const row = await db
      .select({
        id: storyboards.id,
        isScriptGenerated: storyboards.isScriptGenerated,
        frames: storyboards.frames,
        videoInfo: storyboards.videoInfo,
        updatedAt: storyboards.updatedAt
      })
      .from(storyboards)
      .where(eq(storyboards.id, parsed.data.storyboardId))
      .limit(1)

    const durationMs = Date.now() - start
    logger.info({
      event: "internal_get_storyboard_success",
      module: "internal",
      traceId,
      message: "读取 storyboard 信息成功",
      durationMs,
      storyboardId: parsed.data.storyboardId
    })

    return NextResponse.json(makeApiOk(traceId, { storyboard: row[0] ?? null, durationMs }), { status: 200 })
  } catch (e) {
    const durationMs = Date.now() - start
    const anyErr = e as { name?: string; message?: string }
    logger.error({
      event: "internal_get_storyboard_failed",
      module: "internal",
      traceId,
      message: "读取 storyboard 信息失败",
      durationMs,
      storyboardId: parsed.data.storyboardId,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return NextResponse.json(makeApiErr(traceId, "INTERNAL_GET_STORYBOARD_FAILED", "读取 storyboard 失败"), { status: 500 })
  }
}
