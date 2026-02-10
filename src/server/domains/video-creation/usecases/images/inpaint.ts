import { logger } from "@/shared/logger"
import { bakeSelectionBoxToS3, overwriteGeneratedImage } from "@/server/domains/video-creation/services/inpaintService"

type Selection = { x: number; y: number; w: number; h: number }

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

export async function inpaintAndOverwriteGeneratedImage(input: {
  traceId: string
  userId: string
  imageUrl: string
  selection: Selection
  prompt: string
  storyboardId?: string | null
  generatedImageId: string
}): Promise<
  | { ok: true; url: string; generatedImageId: string }
  | { ok: false; code: string; message: string; status: number }
> {
  const start = Date.now()

  const endpoint = process.env.INPAINT_ENDPOINT?.trim() || "https://k9mq4y5xhb.coze.site/run"
  const token = process.env.INPAINT_TOKEN?.trim()
  if (!token) return { ok: false, code: "COZE_TOKEN_MISSING", message: "缺少 INPAINT_TOKEN 环境变量", status: 500 }

  logger.info({
    event: "coze_inpaint_start",
    module: "coze",
    traceId: input.traceId,
    message: "开始调用 Coze 局部重绘",
    storyboardId: input.storyboardId ?? null,
    originalImage: summarizeUrl(input.imageUrl)
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)

  try {
    const bakedUrl = await bakeSelectionBoxToS3({
      traceId: input.traceId,
      sourceUrl: input.imageUrl,
      selection: input.selection,
      storyboardId: input.storyboardId ?? null
    })

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        original_image: { url: bakedUrl, file_type: "default" },
        modification_text: `${input.prompt}`
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
        traceId: input.traceId,
        message: "Coze 局部重绘调用失败",
        durationMs,
        statusCode: res.status
      })
      return { ok: false, code: "COZE_REQUEST_FAILED", message: "局部重绘失败，请稍后重试", status: 502 }
    }

    const outUrl = extractImageUrl(json)
    if (!outUrl) {
      const durationMs = Date.now() - start
      logger.error({
        event: "coze_inpaint_parse_failed",
        module: "coze",
        traceId: input.traceId,
        message: "Coze 局部重绘返回缺少图片 URL",
        durationMs
      })
      return { ok: false, code: "COZE_RESPONSE_INVALID", message: "局部重绘返回异常，请稍后重试", status: 502 }
    }

    const overwrite = await overwriteGeneratedImage({
      traceId: input.traceId,
      userId: input.userId,
      generatedImageId: input.generatedImageId,
      storyboardId: input.storyboardId ?? null,
      sourceUrl: outUrl
    })

    const durationMs = Date.now() - start
    logger.info({
      event: "coze_inpaint_success",
      module: "coze",
      traceId: input.traceId,
      message: "Coze 局部重绘成功并已覆盖原图",
      durationMs
    })

    return { ok: true, url: overwrite.url, generatedImageId: input.generatedImageId }
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string; code?: string }
    if (anyErr?.code === "NOT_FOUND") {
      logger.warn({
        event: "inpaint_overwrite_forbidden",
        module: "video",
        traceId: input.traceId,
        message: "覆盖原图失败：图片不存在或无权限",
        durationMs
      })
      return { ok: false, code: "NOT_FOUND", message: "图片不存在或无权限", status: 404 }
    }
    const code = anyErr?.name === "AbortError" ? "COZE_TIMEOUT" : "COZE_UNKNOWN"
    logger.error({
      event: "coze_inpaint_error",
      module: "coze",
      traceId: input.traceId,
      message: "Coze 局部重绘异常",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return {
      ok: false,
      code,
      message: anyErr?.name === "AbortError" ? "局部重绘超时" : "局部重绘失败，请稍后重试",
      status: 500
    }
  } finally {
    clearTimeout(timer)
  }
}
