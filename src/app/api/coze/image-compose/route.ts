import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  image_list: z
    .array(
      z.object({
        image_name: z.string().trim().min(1).max(200),
        image_url: z.string().trim().url().max(5_000)
      })
    )
    .min(1)
    .max(50),
  prompt: z.union([z.string().min(1).max(20_000), z.array(z.string().min(1).max(20_000)).min(1).max(20)]),
  aspect_ratio: z.string().trim().min(1).max(20)
})

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "coze_image_compose_start",
    module: "coze",
    traceId,
    message: "开始合成图片"
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
      event: "coze_image_compose_validation_failed",
      module: "coze",
      traceId,
      message: "图片合成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const url = readEnv("COZE_IMAGE_COMPOSE_API_URL")
  const token = readEnv("COZE_IMAGE_COMPOSE_API_TOKEN")
  if (!url || !token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_IMAGE_COMPOSE_API_URL 与 COZE_IMAGE_COMPOSE_API_TOKEN"
      ),
      { status: 500 }
    )
  }

  try {
    const payload = {
      ...parsed.data,
      prompt: Array.isArray(parsed.data.prompt) ? parsed.data.prompt : [parsed.data.prompt]
    }
    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: payload,
      module: "coze"
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "coze_image_compose_success",
      module: "coze",
      traceId,
      message: "图片合成成功",
      durationMs,
      cozeStatus: coze.status
    })

    return NextResponse.json(makeApiOk(traceId, coze.data), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "coze_image_compose_failed",
        module: "coze",
        traceId,
        message: "图片合成失败（Coze 调用失败）",
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
      event: "coze_image_compose_error",
      module: "coze",
      traceId,
      message: "图片合成异常",
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
