import { getDb } from "coze-coding-dev-sdk"
import { asc, eq, inArray } from "drizzle-orm"
import { tvcStories, tvcStoryOutlines, tvcStoryboards } from "@/shared/schema"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { logger } from "@/shared/logger"

export async function getTvcProjectShotlist(input: {
  traceId: string
  userId: string
  storyId: string
}): Promise<
  | {
      ok: true
      storyId: string
      outlines: Array<{ id: string; sequence: number; outlineText: string; originalText: string }>
      shots: Array<{
        id: string
        outlineId: string
        sequence: number
        storyboardText: string
        shotCut: boolean
        scriptContent: unknown
        frames: unknown
        videoInfo: unknown
      }>
    }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    await ensureTvcSchema()

    const db = await getDb({ tvcStories, tvcStoryOutlines, tvcStoryboards })
    const [story] = await db
      .select({ id: tvcStories.id, userId: tvcStories.userId, storyType: tvcStories.storyType })
      .from(tvcStories)
      .where(eq(tvcStories.id, input.storyId))
      .limit(1)
    if (!story || story.userId !== input.userId || story.storyType !== "tvc") {
      return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }
    }

    const outlines = await db
      .select({
        id: tvcStoryOutlines.id,
        sequence: tvcStoryOutlines.sequence,
        outlineText: tvcStoryOutlines.outlineText,
        originalText: tvcStoryOutlines.originalText
      })
      .from(tvcStoryOutlines)
      .where(eq(tvcStoryOutlines.storyId, story.id))
      .orderBy(asc(tvcStoryOutlines.sequence))

    const outlineIds = outlines.map((o) => o.id)
    const shots =
      outlineIds.length > 0
        ? await db
            .select({
              id: tvcStoryboards.id,
              outlineId: tvcStoryboards.outlineId,
              sequence: tvcStoryboards.sequence,
              storyboardText: tvcStoryboards.storyboardText,
              shotCut: tvcStoryboards.shotCut,
              scriptContent: tvcStoryboards.scriptContent,
              frames: tvcStoryboards.frames,
              videoInfo: tvcStoryboards.videoInfo
            })
            .from(tvcStoryboards)
            .where(inArray(tvcStoryboards.outlineId, outlineIds))
            .orderBy(asc(tvcStoryboards.outlineId), asc(tvcStoryboards.sequence))
        : []

    return { ok: true, storyId: story.id, outlines, shots }
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown; stack?: unknown }
    const errorCode = typeof err?.code === "string" ? err.code : undefined
    const errorMessage = typeof err?.message === "string" ? err.message : "unknown error"
    const stack = typeof err?.stack === "string" ? err.stack : undefined

    logger.error({
      event: "tvc_shotlist_get_failed",
      module: "tvc",
      traceId: input.traceId,
      message: "读取项目 shotlist 失败",
      projectId: input.storyId,
      errorCode,
      errorMessage,
      stack
    })

    if (errorCode === "42P01" && /tvc\.story_outlines/i.test(errorMessage)) {
      return { ok: false, code: "DB_SCHEMA_NOT_READY", message: "数据库表未初始化：tvc.story_outlines 不存在", status: 500 }
    }
    return { ok: false, code: "DB_QUERY_FAILED", message: "读取项目分镜数据失败", status: 500 }
  }
}

