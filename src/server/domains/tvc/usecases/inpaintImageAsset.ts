import { logger } from "@/shared/logger"
import { bakeSelectionBoxToS3 } from "@/server/domains/video-creation/services/inpaintService"
import { persistTvcImageAsset } from "@/server/domains/tvc/vibeCreating/tooling/assets/persistAssets"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
 
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
 
export async function inpaintTvcImageAsset(input: {
  traceId: string
  userId: string
  storyId: string
  kind: "reference_image" | "first_frame"
  ordinal: number
  imageUrl: string
  selection: Selection
  prompt: string
}): Promise<
  | { ok: true; url: string; thumbnailUrl: string }
  | { ok: false; code: string; message: string; status: number }
> {
  const start = Date.now()
 
  const endpoint = process.env.INPAINT_ENDPOINT?.trim() || "https://k9mq4y5xhb.coze.site/run"
  const token = process.env.INPAINT_TOKEN?.trim()
  if (!token) return { ok: false, code: "COZE_TOKEN_MISSING", message: "缺少 INPAINT_TOKEN 环境变量", status: 500 }
 
  await ensureTvcSchema()
  const db = await getDb({ tvcAssets, tvcStories })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false, code: "NOT_FOUND", message: "项目不存在或无权限", status: 404 }
 
  const [asset] = await db
    .select({ meta: tvcAssets.meta })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, input.storyId), eq(tvcAssets.kind, input.kind), eq(tvcAssets.assetOrdinal, input.ordinal)))
    .limit(1)
  if (!asset) return { ok: false, code: "NOT_FOUND", message: "素材不存在", status: 404 }
 
  logger.info({
    event: "tvc_inpaint_start",
    module: "tvc",
    traceId: input.traceId,
    message: "开始调用 Coze 局部重绘（TVC 资产）",
    storyId: input.storyId,
    kind: input.kind,
    ordinal: input.ordinal,
    originalImage: summarizeUrl(input.imageUrl)
  })
 
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
 
  try {
    const bakedUrl = await bakeSelectionBoxToS3({
      traceId: input.traceId,
      sourceUrl: input.imageUrl,
      selection: input.selection,
      storyboardId: input.storyId
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
        event: "tvc_inpaint_failed",
        module: "tvc",
        traceId: input.traceId,
        message: "Coze 局部重绘调用失败（TVC 资产）",
        durationMs,
        statusCode: res.status
      })
      return { ok: false, code: "COZE_REQUEST_FAILED", message: "局部重绘失败，请稍后重试", status: 502 }
    }
 
    const outUrl = extractImageUrl(json)
    if (!outUrl) {
      const durationMs = Date.now() - start
      logger.error({
        event: "tvc_inpaint_parse_failed",
        module: "tvc",
        traceId: input.traceId,
        message: "Coze 局部重绘返回缺少图片 URL（TVC 资产）",
        durationMs
      })
      return { ok: false, code: "COZE_RESPONSE_INVALID", message: "局部重绘返回异常，请稍后重试", status: 502 }
    }
 
    const existingMeta = (asset.meta ?? {}) as Record<string, unknown>
    const persisted = await persistTvcImageAsset({
      traceId: input.traceId,
      storyId: input.storyId,
      kind: input.kind,
      assetOrdinal: input.ordinal,
      sourceUrl: outUrl,
      meta: existingMeta,
      overwriteExisting: true
    })
 
    const durationMs = Date.now() - start
    logger.info({
      event: "tvc_inpaint_success",
      module: "tvc",
      traceId: input.traceId,
      message: "Coze 局部重绘成功并已覆盖 TVC 资产",
      durationMs
    })
 
    return { ok: true, url: persisted.url, thumbnailUrl: persisted.thumbnailUrl }
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    const code = anyErr?.name === "AbortError" ? "COZE_TIMEOUT" : "COZE_UNKNOWN"
    logger.error({
      event: "tvc_inpaint_error",
      module: "tvc",
      traceId: input.traceId,
      message: "Coze 局部重绘异常（TVC 资产）",
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
