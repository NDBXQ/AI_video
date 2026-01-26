import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { bakeSelectionBoxToS3 } from "@/server/services/inpaintService"
import { createCozeS3Storage } from "@/server/integrations/storage/s3"
import { generateThumbnail } from "@/lib/thumbnail"
import { makeSafeObjectKeySegment } from "@/shared/utils/stringUtils"
import { storyboards, stories, storyOutlines } from "@/shared/schema"
import { mergeStoryboardFrames } from "@/server/services/storyboardAssets"
import sharp from "sharp"

export const runtime = "nodejs"

const inputSchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  frameKind: z.enum(["first", "last"]),
  imageUrl: z.string().trim().min(1).max(4000),
  selection: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1)
  }),
  prompt: z.string().trim().min(1).max(5000)
})

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

  const { storyboardId, frameKind, imageUrl, selection, prompt } = parsed.data

  const db = await getDb({ storyboards, stories, storyOutlines })
  const allowed = await db
    .select({ storyboardFrames: storyboards.frames, storyId: stories.id })
    .from(storyboards)
    .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
    .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
    .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
    .limit(1)

  const row = allowed[0] ?? null
  if (!row) return NextResponse.json(makeApiErr(traceId, "STORYBOARD_NOT_FOUND", "未找到可编辑的分镜"), { status: 404 })

  const endpoint = process.env.COZE_INPAINT_ENDPOINT?.trim() || "https://k9mq4y5xhb.coze.site/run"
  const token = process.env.COZE_INPAINT_TOKEN?.trim()
  if (!token) return NextResponse.json(makeApiErr(traceId, "COZE_TOKEN_MISSING", "缺少 COZE_INPAINT_TOKEN 环境变量"), { status: 500 })

  logger.info({
    event: "storyboard_frame_inpaint_start",
    module: "video",
    traceId,
    message: "开始分镜首尾帧局部重绘",
    storyboardId,
    frameKind
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)

  try {
    const bakedUrl = await bakeSelectionBoxToS3({ traceId, sourceUrl: imageUrl, selection, storyboardId })
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        original_image: { url: bakedUrl, file_type: "default" },
        modification_text: `${prompt}`
      }),
      signal: controller.signal
    })

    const rawText = await res.text().catch(() => "")
    const json = rawText ? (JSON.parse(rawText) as unknown) : null
    if (!res.ok) return NextResponse.json(makeApiErr(traceId, "COZE_REQUEST_FAILED", "局部重绘失败，请稍后重试"), { status: 502 })

    const outUrl = extractImageUrl(json)
    if (!outUrl) return NextResponse.json(makeApiErr(traceId, "COZE_RESPONSE_INVALID", "局部重绘返回异常，请稍后重试"), { status: 502 })

    const outRes = await fetch(outUrl, { method: "GET", cache: "no-store" })
    if (!outRes.ok) return NextResponse.json(makeApiErr(traceId, "COZE_OUTPUT_FETCH_FAILED", "重绘结果下载失败"), { status: 502 })
    const outBytes = Buffer.from(await outRes.arrayBuffer())
    const jpegBytes = await sharp(outBytes, { failOnError: false }).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
    const thumbnailBytes = await generateThumbnail(jpegBytes, 300, traceId)

    const storage = createCozeS3Storage()
    const timestamp = Date.now()
    const safe = makeSafeObjectKeySegment(`sb_${storyboardId}_${frameKind}_${traceId}`, 64)
    const originalFileKey = `storyboard_frame_${row.storyId}_${storyboardId}_${safe}_${timestamp}_original.jpg`
    const thumbnailFileKey = `storyboard_frame_${row.storyId}_${storyboardId}_${safe}_${timestamp}_thumbnail.jpg`

    const uploadedOriginalKey = await storage.uploadFile({ fileContent: jpegBytes, fileName: originalFileKey, contentType: "image/jpeg" })
    const uploadedThumbnailKey = await storage.uploadFile({ fileContent: thumbnailBytes, fileName: thumbnailFileKey, contentType: "image/jpeg" })

    const originalSignedUrl = await storage.generatePresignedUrl({ key: uploadedOriginalKey, expireTime: 604800 })
    const thumbnailSignedUrl = await storage.generatePresignedUrl({ key: uploadedThumbnailKey, expireTime: 604800 })

    const framesPatch =
      frameKind === "first"
        ? { first: { url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl } }
        : { last: { url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl } }
    const nextFrames = mergeStoryboardFrames(row.storyboardFrames as any, framesPatch as any)

    await db
      .update(storyboards)
      .set({
        frames: nextFrames as any,
        isReferenceGenerated: true,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, storyboardId))

    const durationMs = Date.now() - start
    logger.info({
      event: "storyboard_frame_inpaint_success",
      module: "video",
      traceId,
      message: "分镜首尾帧局部重绘成功并已回写",
      storyboardId,
      frameKind,
      durationMs
    })

    return NextResponse.json(makeApiOk(traceId, { url: originalSignedUrl, thumbnailUrl: thumbnailSignedUrl }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    const code = anyErr?.name === "AbortError" ? "COZE_TIMEOUT" : "INPAINT_FAILED"
    logger.error({
      event: "storyboard_frame_inpaint_error",
      module: "video",
      traceId,
      message: "分镜首尾帧局部重绘异常",
      storyboardId,
      frameKind,
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

