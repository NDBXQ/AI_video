import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  outline: z.string().min(1).max(50_000),
  original: z.string().min(1).max(50_000)
})

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
    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: parsed.data,
      module: "coze"
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "storyboard_text_success",
      module: "coze",
      traceId,
      message: "分镜文本生成成功",
      durationMs,
      cozeStatus: coze.status
    })

    return NextResponse.json(makeApiOk(traceId, coze.data), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
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

