import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv, readEnvInt } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { parseRewriteOutput } from "@/features/coze/rewrite/parseRewriteOutput"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  whole_story_outline: z.string().min(1).max(200_000),
  previous_part_outline: z.string().min(1).max(200_000),
  original_title: z.string().trim().min(1).max(500),
  original_content: z.string().min(1).max(200_000),
  next_part_outline: z.string().min(1).max(200_000),
  modification_requirements: z.string().min(1).max(20_000)
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "coze_rewrite_start",
    module: "coze",
    traceId,
    message: "开始改写剧本片段"
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
      event: "coze_rewrite_validation_failed",
      module: "coze",
      traceId,
      message: "改写入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const url = readEnv("COZE_REWRITE_API_URL")
  const token = readEnv("COZE_REWRITE_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_REWRITE_API_URL 与 COZE_REWRITE_API_TOKEN"
      ),
      { status: 500 }
    )
  }

  try {
    const timeoutMs = readEnvInt("COZE_REWRITE_REQUEST_TIMEOUT_MS")
    const text = JSON.stringify(parsed.data)
    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: {
        content: {
          query: {
            prompt: [
              {
                type: "text",
                content: {
                  text
                }
              }
            ]
          }
        },
        type: "query",
        session_id: "nTT4u7yXzwLvb4vqPlloK",
        project_id: 7597286982829686819
      },
      module: "coze",
      timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : undefined
    })

    const output = parseRewriteOutput(coze.data)
    const durationMs = Date.now() - start

    if (!output) {
      logger.error({
        event: "coze_rewrite_response_invalid",
        module: "coze",
        traceId,
        message: "Coze 回包格式不符合预期（缺少 4 个输出字段）",
        durationMs,
        cozeStatus: coze.status
      })
      return NextResponse.json(
        makeApiErr(traceId, "COZE_RESPONSE_INVALID", "Coze 回包格式不符合预期"),
        { status: 502 }
      )
    }

    logger.info({
      event: "coze_rewrite_success",
      module: "coze",
      traceId,
      message: "剧本片段改写成功",
      durationMs,
      cozeStatus: coze.status
    })

    return NextResponse.json(makeApiOk(traceId, output), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "coze_rewrite_failed",
        module: "coze",
        traceId,
        message: "剧本片段改写失败（Coze 调用失败）",
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
      event: "coze_rewrite_error",
      module: "coze",
      traceId,
      message: "剧本片段改写异常",
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
