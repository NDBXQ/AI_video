import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { stories, storyOutlines } from "@/shared/schema"
import { getTraceId } from "@/shared/trace"
import { getSessionFromRequest } from "@/shared/session"
import type { NextRequest } from "next/server"

const inputSchema = z.object({
  input_type: z.string().trim().min(1).max(50),
  story_text: z.string().min(1).max(50_000),
  title: z.string().trim().max(100).optional(),
  ratio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(50).optional(),
  style: z.string().trim().max(50).optional()
})

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

    const db = await getDb({ stories, storyOutlines })
    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: {
        input_type: parsed.data.input_type,
        story_text: parsed.data.story_text
      },
      module: "coze"
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "storyboard_outline_success",
      module: "coze",
      traceId,
      message: "故事大纲生成成功",
      durationMs,
      cozeStatus: coze.status
    })

    const ratio = parsed.data.ratio?.trim() || "16:9"
    const aspectRatio = ratio
    const resolution = parsed.data.resolution?.trim() || "1080p"
    const title = parsed.data.title?.trim() || null
    const storyType = parsed.data.input_type
    const storyText = parsed.data.story_text
    const shotStyle = parsed.data.style?.trim() || "cinema"

    const [story] = await db
      .insert(stories)
      .values({
        userId,
        title,
        storyType,
        resolution,
        aspectRatio,
        storyText,
        shotStyle
      })
      .returning()

    const outlineData = coze.data as unknown
    const list =
      typeof outlineData === "object" &&
      outlineData !== null &&
      "outline_original_list" in outlineData &&
      Array.isArray((outlineData as { outline_original_list?: unknown }).outline_original_list)
        ? ((outlineData as { outline_original_list: Array<{ outline?: unknown; original?: unknown }> })
            .outline_original_list as Array<{ outline?: unknown; original?: unknown }>)
        : []

    if (list.length === 0) {
      logger.warn({
        event: "storyboard_outline_empty_list",
        module: "coze",
        traceId,
        message: "大纲返回列表为空或结构不符合预期"
      })
    }

    if (list.length > 0) {
      await db.insert(storyOutlines).values(
        list.map((item, idx) => {
          return {
            storyId: story.id,
            sequence: idx + 1,
            outlineText: String(item.outline ?? ""),
            originalText: String(item.original ?? "")
          }
        })
      )
    }

    return NextResponse.json(makeApiOk(traceId, { storyId: story.id, coze: coze.data }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    if (err instanceof CozeRunEndpointError) {
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

    return NextResponse.json(makeApiErr(traceId, "COZE_UNKNOWN", "生成失败，请稍后重试"), {
      status: 500
    })
  }
}
