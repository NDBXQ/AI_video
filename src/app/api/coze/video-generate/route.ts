import { NextResponse } from "next/server"
import { z } from "zod"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  prompt: z.string().min(1).max(20_000),
  mode: z.string().trim().min(1).max(50),
  generate_audio: z.boolean(),
  ratio: z.string().trim().min(1).max(20),
  duration: z.number().int().min(1).max(60),
  watermark: z.boolean(),
  image: z.object({
    url: z.string().trim().url().max(5_000),
    file_type: z.string().trim().min(1).max(50)
  })
})

const DEFAULT_VIDEO_GENERATE_URL = "https://3f47zmnfcb.coze.site/run"

function extractVideoUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const anyData = data as Record<string, unknown>
  const candidates = [
    anyData["generated_video_url"],
    anyData["video_url"],
    anyData["data"],
    anyData["url"]
  ]

  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("http")) return value
  }

  return undefined
}

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "coze_video_generate_start",
    module: "coze",
    traceId,
    message: "开始生成视频"
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
      event: "coze_video_generate_validation_failed",
      module: "coze",
      traceId,
      message: "视频生成入参校验失败"
    })
    return NextResponse.json(makeApiErr(traceId, "COZE_VALIDATION_FAILED", "入参格式不正确"), {
      status: 400
    })
  }

  const url = readEnv("COZE_VIDEO_GENERATE_API_URL") ?? DEFAULT_VIDEO_GENERATE_URL
  const token = readEnv("COZE_VIDEO_GENERATE_API_TOKEN")
  if (!token) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "COZE_NOT_CONFIGURED",
        "Coze 未配置，请设置 COZE_VIDEO_GENERATE_API_TOKEN（URL 可选）"
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
      module: "coze",
      timeoutMs: 120_000
    })

    const durationMs = Date.now() - start
    const videoUrl = extractVideoUrl(coze.data)

    logger.info({
      event: "coze_video_generate_success",
      module: "coze",
      traceId,
      message: "视频生成成功",
      durationMs,
      cozeStatus: coze.status,
      hasVideoUrl: Boolean(videoUrl)
    })

    return NextResponse.json(
      makeApiOk(traceId, { ...((coze.data ?? {}) as Record<string, unknown>), extracted_video_url: videoUrl }),
      { status: 200 }
    )
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
      logger.error({
        event: "coze_video_generate_failed",
        module: "coze",
        traceId,
        message: "视频生成失败（Coze 调用失败）",
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
      event: "coze_video_generate_error",
      module: "coze",
      traceId,
      message: "视频生成异常",
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

