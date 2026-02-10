import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { getSessionFromRequest } from "@/shared/session"
import type { NextRequest } from "next/server"

const inputSchema = z.object({
  outlineId: z.string().trim().min(1).max(200),
  outline: z.string().min(1).max(50_000),
  original: z.string().min(1).max(50_000),
  async: z.boolean().optional()
})

import { enqueueCozeGenerateStoryboardTextJob, kickCozeStoryboardWorker } from "@/server/domains/storyboard/jobs/cozeStoryboardWorker"
import { runGenerateStoryboardText } from "@/server/domains/storyboard/integrations/cozeStoryboardTasks"

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "storyboard_text_start",
    module: "coze",
    traceId,
    message: "开始生成分镜文本"
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
      event: "storyboard_text_validation_failed",
      module: "coze",
      traceId,
      message: "分镜文本生成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const url = readEnv("CREATE_STORYBOARD_TEXT_URL")
  const token = readEnv("CREATE_STORYBOARD_TEXT_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 CREATE_STORYBOARD_TEXT_URL 与 CREATE_STORYBOARD_TEXT_TOKEN"
      ),
      { status: 500 }
    )
  }

  try {
    const session = await getSessionFromRequest(req as unknown as NextRequest)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), {
        status: 401
      })
    }

    const asyncMode = parsed.data.async ?? false
    if (asyncMode) {
      const { jobId, snapshot } = await enqueueCozeGenerateStoryboardTextJob({
        userId,
        traceId,
        outlineId: parsed.data.outlineId,
        outline: parsed.data.outline,
        original: parsed.data.original
      })
      kickCozeStoryboardWorker()
      logger.info({
        event: "storyboard_text_async_queued",
        module: "coze",
        traceId,
        message: "分镜文本生成任务已入队",
        jobId,
        outlineId: parsed.data.outlineId
      })
      return NextResponse.json(makeApiOk(traceId, { jobId, status: snapshot.status }), { status: 202 })
    }

    const result = await runGenerateStoryboardText({
      traceId,
      userId,
      outlineId: parsed.data.outlineId,
      outline: parsed.data.outline,
      original: parsed.data.original
    })

    logger.info({
      event: "storyboard_text_success",
      module: "coze",
      traceId,
      message: "分镜文本生成成功",
      durationMs: result.durationMs,
      cozeStatus: result.cozeStatus,
      outlineId: parsed.data.outlineId,
      persistedTotal: result.persistedTotal
    })

    return NextResponse.json(makeApiOk(traceId, result.coze), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      // 3. Mark Storyboard Text Failed (Coze Error)
      // We have outlineId, so we can find storyId (already queried above as storyRow, but variable scope issue)
      // Re-query storyId or use if available.
      // In this function scope, we don't have storyId in the catch block easily unless we move logic.
      // However, we can use updateStoryStatus with error info if we could access storyId.
      // Given constraints, we skip detailed status update on failure here or need refactor.
      // To keep it simple and safe: just log error as before.
      
      logger.error({
        event: "storyboard_text_failed",
        module: "coze",
        traceId,
        message: "分镜文本生成失败（Coze 调用失败）",
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
      event: "storyboard_text_error",
      module: "coze",
      traceId,
      message: "分镜文本生成异常",
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
