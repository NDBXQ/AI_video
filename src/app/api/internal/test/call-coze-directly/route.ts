import { NextResponse } from "next/server"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "coze_direct_call_start",
    module: "coze",
    traceId,
    message: "开始直连调用 Coze（内部测试接口）"
  })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "COZE_INVALID_JSON", "请求体不是合法 JSON"), {
      status: 400
    })
  }

  const url = readEnv("COZE_PROMPT_API_URL")
  const token = readEnv("COZE_PROMPT_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_PROMPT_API_URL 与 COZE_PROMPT_API_TOKEN"
      ),
      { status: 500 }
    )
  }

  try {
    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: json,
      module: "coze"
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "coze_direct_call_success",
      module: "coze",
      traceId,
      message: "直连调用 Coze 成功",
      durationMs,
      cozeStatus: coze.status
    })

    return NextResponse.json(makeApiOk(traceId, coze.data), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "coze_direct_call_failed",
        module: "coze",
        traceId,
        message: "直连调用 Coze 失败（Coze 调用失败）",
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
      event: "coze_direct_call_error",
      module: "coze",
      traceId,
      message: "直连调用 Coze 异常",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    return NextResponse.json(makeApiErr(traceId, "COZE_UNKNOWN", "调用失败，请稍后重试"), {
      status: 500
    })
  }
}

