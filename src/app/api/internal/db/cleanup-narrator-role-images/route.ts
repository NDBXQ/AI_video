import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { generatedImages } from "@/shared/schema"

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "db_cleanup_narrator_role_images_start",
    module: "db",
    traceId,
    message: "开始清理旁白角色图片数据"
  })

  try {
    const db = await getDb({ generatedImages })

    const deleted = await db
      .delete(generatedImages)
      .where(and(eq(generatedImages.category, "role"), eq(generatedImages.name, "旁白")))
      .returning({ id: generatedImages.id })

    const durationMs = Date.now() - start
    logger.info({
      event: "db_cleanup_narrator_role_images_success",
      module: "db",
      traceId,
      message: "清理旁白角色图片数据成功",
      durationMs,
      deletedCount: deleted.length
    })

    return NextResponse.json(makeApiOk(traceId, { deletedCount: deleted.length }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "db_cleanup_narrator_role_images_failed",
      module: "db",
      traceId,
      message: "清理旁白角色图片数据失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "DB_CLEANUP_FAILED", "清理失败"), { status: 500 })
  }
}

