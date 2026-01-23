import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { bakeSelectionBoxToS3, overwriteGeneratedImage } from "@/server/services/inpaintService"

export const runtime = "nodejs"

const inputSchema = z.object({
  imageUrl: z.string().trim().min(1).max(4000),
  selection: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1)
  }),
  prompt: z.string().trim().min(1).max(5000),
  storyboardId: z.string().trim().min(1).max(200).nullable().optional(),
  generatedImageId: z.string().trim().min(1).max(200).nullable().optional()
})

function summarizeUrl(raw: string): { host?: string; protocol?: string } {
  try {
    const u = new URL(raw)
    return { host: u.host, protocol: u.protocol }
  } catch {
    return {}
  }
}

function extractImageUrl(payload: unknown): string | null {
  const obj = payload as any
  const candidates = [
    obj?.modified_image_url,
    obj?.modifiedImageUrl,
    obj?.data?.url,
    obj?.data?.image_url,
    obj?.data?.imageUrl,
    obj?.data?.output_image,
    obj?.data?.output_image_url,
    obj?.result?.url,
    obj?.result?.image_url,
    obj?.result?.imageUrl,
    obj?.result?.output_image,
    obj?.result?.output_image_url,
    obj?.output_image_url,
    obj?.outputImageUrl,
    obj?.url
  ]
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  const listCandidates = [obj?.data?.images, obj?.result?.images, obj?.images]
  for (const list of listCandidates) {
    if (Array.isArray(list) && typeof list[0] === "string" && list[0].trim()) return list[0].trim()
  }
  return null
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { imageUrl, selection, prompt, storyboardId, generatedImageId } = parsed.data
  const effectiveGeneratedImageId = typeof generatedImageId === "string" && generatedImageId.trim() ? generatedImageId.trim() : ""
  if (!effectiveGeneratedImageId) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 generatedImageId，无法覆盖原图"), { status: 400 })
  }

  const endpoint = process.env.COZE_INPAINT_ENDPOINT?.trim() || "https://k9mq4y5xhb.coze.site/run"
  const token = process.env.COZE_INPAINT_TOKEN?.trim()
  if (!token) return NextResponse.json(makeApiErr(traceId, "COZE_TOKEN_MISSING", "缺少 COZE_INPAINT_TOKEN 环境变量"), { status: 500 })

  logger.info({
    event: "coze_inpaint_start",
    module: "coze",
    traceId,
    message: "开始调用 Coze 局部重绘",
    storyboardId: storyboardId ?? null,
    originalImage: summarizeUrl(imageUrl)
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)

  try {
    const bakedUrl = await bakeSelectionBoxToS3({ traceId, sourceUrl: imageUrl, selection, storyboardId })
    const selectionHint = `选区（归一化坐标 x,y,w,h）：${selection.x.toFixed(4)},${selection.y.toFixed(4)},${selection.w.toFixed(4)},${selection.h.toFixed(4)}`
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        original_image: { url: bakedUrl , file_type: "default"},
        modification_text: `${prompt}`
      }),
      signal: controller.signal
    })

    const rawText = await res.text().catch(() => "")
    const json = rawText ? (JSON.parse(rawText) as unknown) : null
    if (!res.ok) {
      const durationMs = Date.now() - start
      logger.error({
        event: "coze_inpaint_failed",
        module: "coze",
        traceId,
        message: "Coze 局部重绘调用失败",
        durationMs,
        statusCode: res.status
      })
      return NextResponse.json(makeApiErr(traceId, "COZE_REQUEST_FAILED", "局部重绘失败，请稍后重试"), { status: 502 })
    }

    const outUrl = extractImageUrl(json)
    if (!outUrl) {
      const durationMs = Date.now() - start
      logger.error({
        event: "coze_inpaint_parse_failed",
        module: "coze",
        traceId,
        message: "Coze 局部重绘返回缺少图片 URL",
        durationMs
      })
      return NextResponse.json(makeApiErr(traceId, "COZE_RESPONSE_INVALID", "局部重绘返回异常，请稍后重试"), { status: 502 })
    }

    const overwrite = await overwriteGeneratedImage({
      traceId,
      userId,
      generatedImageId: effectiveGeneratedImageId,
      storyboardId,
      sourceUrl: outUrl
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "coze_inpaint_success",
      module: "coze",
      traceId,
      message: "Coze 局部重绘成功并已覆盖原图",
      durationMs
    })

    return NextResponse.json(makeApiOk(traceId, { url: overwrite.url, generatedImageId: effectiveGeneratedImageId }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string; code?: string }
    if (anyErr?.code === "NOT_FOUND") {
      logger.warn({
        event: "inpaint_overwrite_forbidden",
        module: "video",
        traceId,
        message: "覆盖原图失败：图片不存在或无权限",
        durationMs
      })
      return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "图片不存在或无权限"), { status: 404 })
    }
    const code = anyErr?.name === "AbortError" ? "COZE_TIMEOUT" : "COZE_UNKNOWN"
    logger.error({
      event: "coze_inpaint_error",
      module: "coze",
      traceId,
      message: "Coze 局部重绘异常",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, code, anyErr?.name === "AbortError" ? "局部重绘超时" : "局部重绘失败，请稍后重试"), { status: 500 })
  } finally {
    clearTimeout(timer)
  }
}
