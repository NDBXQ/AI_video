import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/shared/session"
import { enqueueCozeGenerateScriptJob, kickCozeStoryboardWorker } from "@/server/domains/storyboard/jobs/cozeStoryboardWorker"
import { runGenerateScript } from "@/server/domains/storyboard/integrations/cozeStoryboardTasks"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"

const inputSchema = z.object({
  raw_script: z.string().min(1).max(80_000),
  storyboardId: z.string().min(1).optional(),
  async: z.boolean().optional()
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "coze_generate_script_start",
    module: "coze",
    traceId,
    message: "开始生成分镜脚本"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "COZE_INVALID_JSON", "请求体不是合法 JSON"), {
      status: 400
    })
  }

  const parsed = inputSchema.safeParse(json)
  if (!parsed.success) {
    logger.warn({
      event: "coze_generate_script_validation_failed",
      module: "coze",
      traceId,
      message: "分镜脚本生成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  let effectiveDemand = "无其他需求"
  const storyboardId = parsed.data.storyboardId?.trim() || undefined
  if (storyboardId) {
    const session = await getSessionFromRequest(req as unknown as NextRequest)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), {
        status: 401
      })
    }

    const db = await getDb({ stories, storyOutlines, storyboards })
    const rows = await db
      .select({ shotCut: storyboards.shotCut })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
      .limit(1)

    if (rows.length === 0) {
      return NextResponse.json(makeApiErr(traceId, "STORYBOARD_NOT_FOUND", "未找到可用的分镜"), { status: 404 })
    }
    effectiveDemand = String(Boolean(rows[0]?.shotCut)) === "true" ? "需要切镜" : "无需切镜"
  }

  const asyncMode = parsed.data.async ?? false
  if (asyncMode) {
    const session = await getSessionFromRequest(req as unknown as NextRequest)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), {
        status: 401
      })
    }

    const { jobId, snapshot } = await enqueueCozeGenerateScriptJob({
      userId,
      traceId,
      raw_script: parsed.data.raw_script,
      demand: effectiveDemand,
      storyboardId
    })
    kickCozeStoryboardWorker()

    logger.info({
      event: "coze_generate_script_async_queued",
      module: "coze",
      traceId,
      message: "分镜脚本生成任务已入队",
      jobId
    })

    return NextResponse.json(makeApiOk(traceId, { jobId, status: snapshot.status }), { status: 202 })
  }

  const url = readEnv("SCRIPT_API_URL")
  const token = readEnv("SCRIPT_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 SCRIPT_API_URL 与 SCRIPT_API_TOKEN"
      ),
      { status: 500 }
    )
  }

  try {
    const { coze, durationMs, cozeStatus } = await runGenerateScript({
      traceId,
      raw_script: parsed.data.raw_script,
      demand: effectiveDemand,
      storyboardId
    })

    logger.info({
      event: "coze_generate_script_success",
      module: "coze",
      traceId,
      message: "分镜脚本生成成功",
      durationMs,
      cozeStatus
    })

    return NextResponse.json(makeApiOk(traceId, coze), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "coze_generate_script_failed",
        module: "coze",
        traceId,
        message: "分镜脚本生成失败（Coze 调用失败）",
        durationMs,
        status: err.status
      })
      return NextResponse.json(
        makeApiErr(traceId, "COZE_REQUEST_FAILED", "Coze 调用失败，请稍后重试"),
        { status: 502 }
      )
    }

    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "coze_generate_script_error",
      module: "coze",
      traceId,
      message: "分镜脚本生成异常",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    return NextResponse.json(makeApiErr(traceId, "COZE_UNKNOWN", "生成失败，请稍后重试"), {
      status: 500
    })
  }
}
