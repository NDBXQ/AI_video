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
  storyId: z.string().trim().min(1).max(200).optional(),
  input_type: z.string().trim().min(1).max(50),
  story_text: z.string().min(1).max(50_000),
  title: z.string().trim().max(100).optional(),
  ratio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(50).optional(),
  style: z.string().trim().max(50).optional(),
  async: z.boolean().optional()
})

import { enqueueCozeGenerateOutlineJob, kickCozeStoryboardWorker } from "@/server/jobs/cozeStoryboardWorker"
import { runGenerateOutline } from "@/server/coze/storyboardTasks"

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "storyboard_outline_start",
    module: "coze",
    traceId,
    message: "开始生成故事大纲"
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
      event: "storyboard_outline_validation_failed",
      module: "coze",
      traceId,
      message: "大纲生成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const url = readEnv("COZE_OUTLINE_API_URL")
  const token = readEnv("COZE_OUTLINE_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_API_URL 与 COZE_API_TOKEN"
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
      const { jobId, snapshot } = await enqueueCozeGenerateOutlineJob({
        userId,
        traceId,
        storyId: parsed.data.storyId,
        input_type: parsed.data.input_type,
        story_text: parsed.data.story_text,
        title: parsed.data.title,
        ratio: parsed.data.ratio,
        resolution: parsed.data.resolution,
        style: parsed.data.style
      })
      kickCozeStoryboardWorker()
      logger.info({
        event: "storyboard_outline_async_queued",
        module: "coze",
        traceId,
        message: "故事大纲生成任务已入队",
        jobId
      })
      return NextResponse.json(makeApiOk(traceId, { jobId, status: snapshot.status }), { status: 202 })
    }

    const result = await runGenerateOutline({
      traceId,
      userId,
      storyId: parsed.data.storyId,
      input_type: parsed.data.input_type,
      story_text: parsed.data.story_text,
      title: parsed.data.title,
      ratio: parsed.data.ratio,
      resolution: parsed.data.resolution,
      style: parsed.data.style
    })

    logger.info({
      event: "storyboard_outline_success",
      module: "coze",
      traceId,
      message: "故事大纲生成成功",
      durationMs: result.durationMs,
      cozeStatus: result.cozeStatus
    })

    return NextResponse.json(makeApiOk(traceId, { storyId: result.storyId, coze: result.coze }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      // 3. Mark Outline Failed (Coze Error)
      // Note: We don't have storyId easily accessible here if DB insert hasn't happened yet.
      // But if we fail at Coze step, the story row hasn't been created yet (db insert is AFTER coze call).
      // So we can't update story status. We just log error.
      logger.error({
        event: "storyboard_outline_failed",
        module: "coze",
        traceId,
        message: "故事大纲生成失败（Coze 调用失败）",
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
      event: "storyboard_outline_error",
      module: "coze",
      traceId,
      message: "故事大纲生成异常",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    
    // We can't update story status because story hasn't been created if error happens before DB insert.
    // If error happens AFTER DB insert (e.g. story_outlines insert fail), we could update story status if we had story variable scope.
    // Given the current structure, `story` variable is inside try block. We can't access it here easily without refactoring.
    // For now, assume failure before story creation means no story record to update.

    return NextResponse.json(makeApiErr(traceId, "COZE_UNKNOWN", "生成失败，请稍后重试"), {
      status: 500
    })
  }
}
