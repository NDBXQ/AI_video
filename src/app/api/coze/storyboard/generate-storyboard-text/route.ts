import { NextResponse } from "next/server"
import { z } from "zod"
import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"
import { callCozeRunEndpoint, CozeRunEndpointError } from "@/features/coze/runEndpointClient"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"
import { getSessionFromRequest } from "@/shared/session"
import { stories, storyOutlines, storyboards } from "@/shared/schema"
import type { NextRequest } from "next/server"

const inputSchema = z.object({
  outlineId: z.string().trim().min(1).max(200),
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
    const session = await getSessionFromRequest(req as unknown as NextRequest)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), {
        status: 401
      })
    }

    const db = await getDb({ stories, storyOutlines, storyboards })
    const outlineId = parsed.data.outlineId
    const outlineText = parsed.data.outline
    const originalText = parsed.data.original

    const [outlineRow] = await db
      .select({ storyId: storyOutlines.storyId })
      .from(storyOutlines)
      .where(eq(storyOutlines.id, outlineId))
      .limit(1)
    if (!outlineRow?.storyId) {
      return NextResponse.json(makeApiErr(traceId, "OUTLINE_NOT_FOUND", "大纲章节不存在"), {
        status: 404
      })
    }

    const [storyRow] = await db
      .select({ userId: stories.userId })
      .from(stories)
      .where(eq(stories.id, outlineRow.storyId))
      .limit(1)
    if (!storyRow?.userId || storyRow.userId !== userId) {
      return NextResponse.json(makeApiErr(traceId, "OUTLINE_NOT_FOUND", "大纲章节不存在"), {
        status: 404
      })
    }

    const coze = await callCozeRunEndpoint({
      traceId,
      url,
      token,
      body: { outline: outlineText, original: originalText },
      module: "coze"
    })

    const payload = coze.data as unknown
    const storyboardList =
      typeof payload === "object" &&
      payload !== null &&
      "storyboard_list" in payload &&
      Array.isArray((payload as { storyboard_list?: unknown }).storyboard_list)
        ? ((payload as { storyboard_list: Array<{ shot_cut?: unknown; storyboard_text?: unknown }> })
            .storyboard_list as Array<{ shot_cut?: unknown; storyboard_text?: unknown }>)
        : []

    if (storyboardList.length === 0) {
      logger.warn({
        event: "storyboard_text_empty_list",
        module: "coze",
        traceId,
        message: "分镜文本返回列表为空或结构不符合预期",
        outlineId
      })
    }

    const existingRows = await db
      .select({
        id: storyboards.id,
        sequence: storyboards.sequence,
        isReferenceGenerated: storyboards.isReferenceGenerated,
        isVideoGenerated: storyboards.isVideoGenerated,
        isScriptGenerated: storyboards.isScriptGenerated
      })
      .from(storyboards)
      .where(eq(storyboards.outlineId, outlineId))
      .orderBy(asc(storyboards.sequence))

    const existingBySeq = new Map<number, (typeof existingRows)[number]>()
    for (const row of existingRows) existingBySeq.set(row.sequence, row)

    let inserted = 0
    let updated = 0
    let deleted = 0
    let skipped = 0

    for (let i = 0; i < storyboardList.length; i += 1) {
      const item = storyboardList[i]
      const seq = i + 1
      const shotCut = Boolean(item?.shot_cut)
      const storyboardText = String(item?.storyboard_text ?? "")
      const existing = existingBySeq.get(seq)
      const isLocked =
        !!existing &&
        (existing.isReferenceGenerated || existing.isVideoGenerated || existing.isScriptGenerated)

      if (isLocked) {
        skipped += 1
        continue
      }

      if (existing?.id) {
        await db
          .update(storyboards)
          .set({
            sceneTitle: outlineText,
            originalText,
            shotCut,
            storyboardText,
            updatedAt: new Date()
          })
          .where(eq(storyboards.id, existing.id))
        updated += 1
        continue
      }

      await db.insert(storyboards).values({
        outlineId,
        sequence: seq,
        sceneTitle: outlineText,
        originalText,
        shotCut,
        storyboardText
      })
      inserted += 1
    }

    const deletableIds = existingRows
      .filter((row) => {
        if (row.sequence <= storyboardList.length) return false
        if (row.isReferenceGenerated || row.isVideoGenerated || row.isScriptGenerated) return false
        return true
      })
      .map((row) => row.id)
      .filter((id): id is string => !!id)

    if (deletableIds.length > 0) {
      await db
        .delete(storyboards)
        .where(and(eq(storyboards.outlineId, outlineId), inArray(storyboards.id, deletableIds)))
      deleted = deletableIds.length
    }

    const durationMs = Date.now() - start
    logger.info({
      event: "storyboard_text_success",
      module: "coze",
      traceId,
      message: "分镜文本生成成功",
      durationMs,
      cozeStatus: coze.status,
      outlineId,
      persistedTotal: storyboardList.length,
      inserted,
      updated,
      skipped,
      deleted
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
