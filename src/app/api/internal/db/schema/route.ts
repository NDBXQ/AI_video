import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { stories, storyOutlines, storyboards } from "@/shared/schema"

/**
 * 获取 stories 与 story_outlines 表结构（列清单）
 * @returns {Promise<Response>} JSON 响应
 */
export async function GET(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "db_schema_inspect_start",
    module: "db",
    traceId,
    message: "开始读取数据表结构"
  })

  try {
    const db = await getDb({ stories, storyOutlines, storyboards })

    const storiesCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stories'
      ORDER BY ordinal_position
    `)

    const outlinesCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'story_outlines'
      ORDER BY ordinal_position
    `)

    const storyboardsCols = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'storyboards'
      ORDER BY ordinal_position
    `)

    const durationMs = Date.now() - start
    logger.info({
      event: "db_schema_inspect_success",
      module: "db",
      traceId,
      message: "读取数据表结构成功",
      durationMs
    })

    return NextResponse.json(
      makeApiOk(traceId, {
        stories: (storiesCols as unknown as { rows?: unknown[] }).rows ?? storiesCols,
        story_outlines: (outlinesCols as unknown as { rows?: unknown[] }).rows ?? outlinesCols,
        storyboards: (storyboardsCols as unknown as { rows?: unknown[] }).rows ?? storyboardsCols
      })
    )
  } catch (err) {
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "db_schema_inspect_failed",
      module: "db",
      traceId,
      message: "读取数据表结构失败",
      errorName: anyErr?.name,
      errorMessage: anyErr?.message
    })
    return NextResponse.json(
      makeApiErr(traceId, "DB_SCHEMA_READ_FAILED", "无法读取数据表结构，请检查数据库配置"),
      { status: 500 }
    )
  }
}
