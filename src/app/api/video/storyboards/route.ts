import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { StoryboardService } from "@/server/domains/storyboard/services/storyboardService"

const querySchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  outlineId: z.string().trim().min(1).max(200).optional()
})

const updateStoryboardSchema = z
  .object({
    storyboardId: z.string().trim().min(1).max(200),
    storyboardText: z.string().max(20000).optional(),
    scriptContent: z.unknown().optional(),
    frames: z
      .object({
        first: z
          .object({
            prompt: z.string().max(80_000).optional(),
            url: z.string().max(2000).optional(),
            thumbnailUrl: z.string().max(2000).optional()
          })
          .partial()
          .optional(),
        last: z
          .object({
            prompt: z.string().max(80_000).optional(),
            url: z.string().max(2000).optional(),
            thumbnailUrl: z.string().max(2000).optional()
          })
          .partial()
          .optional()
      })
      .partial()
      .optional(),
    videoInfo: z
      .object({
        prompt: z.string().max(80_000).optional(),
        durationSeconds: z.coerce.number().int().min(1).max(60).optional(),
        url: z.string().max(2000).optional(),
        storageKey: z.string().max(2000).optional(),
        settings: z
          .object({
            mode: z.string().max(2000).optional(),
            generateAudio: z.boolean().optional(),
            watermark: z.boolean().optional()
          })
          .partial()
          .optional()
      })
      .partial()
      .optional()
  })
  .refine(
    (value) =>
      value.storyboardText !== undefined ||
      value.scriptContent !== undefined ||
      value.frames !== undefined ||
      value.videoInfo !== undefined,
    {
      message: "必须至少提供 storyboardText、scriptContent、frames、videoInfo 之一"
    }
  )

const deleteStoryboardsSchema = z.object({
  storyboardIds: z.array(z.string().trim().min(1).max(200)).min(1).max(200)
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  logger.info({
    event: "video_storyboards_get_start",
    module: "video",
    traceId,
    message: "开始读取视频页分镜数据"
  })

  try {
    const session = await getSessionFromRequest(req)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })
    }

    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      storyId: url.searchParams.get("storyId") ?? undefined,
      outlineId: url.searchParams.get("outlineId") ?? undefined
    })
    if (!parsed.success) {
      return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
    }

    const result = await StoryboardService.getStoryboards(userId, parsed.data)
    if (!result) {
      return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })
    }

    const durationMs = Date.now() - start
    logger.info({
      event: "video_storyboards_get_success",
      module: "video",
      traceId,
      message: "读取视频页分镜数据成功",
      durationMs,
      storyId: result.storyId,
      outlineCount: result.outlines.length,
      shotCount: result.shots.length
    })

    return NextResponse.json(makeApiOk(traceId, result), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "video_storyboards_get_failed",
      module: "video",
      traceId,
      message: "读取视频页分镜数据失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "VIDEO_STORYBOARDS_READ_FAILED", "读取分镜数据失败"), {
      status: 500
    })
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  try {
    const session = await getSessionFromRequest(req)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = deleteStoryboardsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
    }

    const result = await StoryboardService.deleteStoryboards(userId, parsed.data.storyboardIds, traceId)
    if (!result) {
      return NextResponse.json(makeApiErr(traceId, "STORYBOARD_NOT_FOUND", "未找到可删除的分镜"), { status: 404 })
    }

    const durationMs = Date.now() - start
    logger.info({
      event: "video_storyboards_delete_success",
      module: "video",
      traceId,
      message: "删除分镜完成",
      durationMs,
      deletedCount: result.deletedIds.length
    })

    return NextResponse.json(makeApiOk(traceId, result), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "video_storyboards_delete_failed",
      module: "video",
      traceId,
      message: "删除分镜失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "VIDEO_STORYBOARDS_DELETE_FAILED", "删除分镜失败"), { status: 500 })
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  try {
    const session = await getSessionFromRequest(req)
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = updateStoryboardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
    }

    const result = await StoryboardService.updateStoryboard(
      userId,
      { ...parsed.data, scriptContent: parsed.data.scriptContent as any },
      traceId
    )
    if (!result) {
      return NextResponse.json(makeApiErr(traceId, "STORYBOARD_NOT_FOUND", "未找到可编辑的分镜"), { status: 404 })
    }

    const durationMs = Date.now() - start
    logger.info({
      event: "video_storyboard_update_success",
      module: "video",
      traceId,
      message: "更新分镜数据成功",
      durationMs,
      storyboardId: parsed.data.storyboardId
    })

    return NextResponse.json(makeApiOk(traceId, result), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "video_storyboard_update_failed",
      module: "video",
      traceId,
      message: "更新分镜数据失败",
      durationMs,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })
    return NextResponse.json(makeApiErr(traceId, "VIDEO_STORYBOARD_UPDATE_FAILED", "更新分镜描述失败"), {
      status: 500
    })
  }
}
