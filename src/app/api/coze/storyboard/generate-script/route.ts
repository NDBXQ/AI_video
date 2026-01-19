import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  raw_script: z.string().min(1).max(80_000),
  demand: z.string().min(1).max(10_000)
})

function hasVideoScriptField(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const anyData = data as Record<string, unknown>
  const direct = anyData["video_script"]
  if (direct && typeof direct === "object") return true

  const nested = anyData["data"]
  if (nested && typeof nested === "object") {
    const nestedAny = nested as Record<string, unknown>
    const videoScript = nestedAny["video_script"]
    if (videoScript && typeof videoScript === "object") return true
  }

  return false
}

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

  const url = readEnv("COZE_SCRIPT_API_URL")
  const token = readEnv("COZE_SCRIPT_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_SCRIPT_API_URL 与 COZE_SCRIPT_API_TOKEN"
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

    if (!hasVideoScriptField(coze.data)) {
      logger.error({
        event: "coze_generate_script_response_invalid",
        module: "coze",
        traceId,
        message: "Coze 回包缺少 video_script 字段",
        durationMs,
        cozeStatus: coze.status
      })
      return NextResponse.json(
        makeApiErr(traceId, "COZE_RESPONSE_INVALID", "Coze 回包格式不符合预期"),
        { status: 502 }
      )
    }

    logger.info({
      event: "coze_generate_script_success",
      module: "coze",
      traceId,
      message: "分镜脚本生成成功",
      durationMs,
      cozeStatus: coze.status
    })

    return NextResponse.json(makeApiOk(traceId, coze.data), { status: 200 })
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

