import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories, storyOutlines, storyboards } from "@/shared/schema"
import { logger } from "@/shared/logger"
import { updateStoryStatus } from "@/features/video/utils/storyStatus"
import { mergeStoryboardFrames, mergeStoryboardVideoInfo } from "@/server/services/storyboardAssets"

export class StoryboardService {
  static async getStoryboards(userId: string, params: { storyId?: string; outlineId?: string }) {
    const db = await getDb({ stories, storyOutlines, storyboards })
    const storyId =
      params.storyId ??
      (
        await db
          .select({ id: stories.id })
          .from(stories)
          .where(eq(stories.userId, userId))
          .orderBy(desc(stories.createdAt))
          .limit(1)
      )[0]?.id ??
      null

    if (!storyId) return null

    const outlineRows = await db
      .select({
        id: storyOutlines.id,
        sequence: storyOutlines.sequence,
        outlineText: storyOutlines.outlineText,
        originalText: storyOutlines.originalText,
        outlineDrafts: storyOutlines.outlineDrafts,
        activeOutlineDraftId: storyOutlines.activeOutlineDraftId
      })
      .from(storyOutlines)
      .where(eq(storyOutlines.storyId, storyId))
      .orderBy(asc(storyOutlines.sequence))

    const outlines = outlineRows.map((o) => {
      const draftsRaw = o.outlineDrafts as unknown
      const drafts = Array.isArray(draftsRaw) ? (draftsRaw as Array<Record<string, unknown>>) : []
      const activeId = typeof o.activeOutlineDraftId === "string" ? o.activeOutlineDraftId.trim() : ""
      const activeDraft = activeId ? drafts.find((d) => (typeof d?.id === "string" ? d.id : "") === activeId) : null
      const activeContent = activeDraft && typeof activeDraft.content === "string" ? activeDraft.content.trim() : ""
      const effectiveOriginal = activeContent || (o.originalText ?? "")
      return { id: o.id, sequence: o.sequence, outlineText: o.outlineText, originalText: effectiveOriginal }
    })

    const outlineIds = outlines.map((o) => o.id)
    const counts =
      outlineIds.length > 0
        ? await db
            .select({
              outlineId: storyboards.outlineId,
              cnt: sql<number>`count(*)`.mapWith(Number)
            })
            .from(storyboards)
            .where(inArray(storyboards.outlineId, outlineIds))
            .groupBy(storyboards.outlineId)
        : []

    const countByOutlineId = new Map<string, number>()
    for (const row of counts) countByOutlineId.set(row.outlineId, row.cnt)

    const activeOutlineId = (() => {
      const requested = params.outlineId
      if (requested && outlineIds.includes(requested)) return requested
      return outlines[0]?.id ?? null
    })()

    const shots =
      activeOutlineId && outlineIds.length > 0
        ? await db
            .select({
              id: storyboards.id,
              sequence: storyboards.sequence,
              storyboardText: storyboards.storyboardText,
              shotCut: storyboards.shotCut,
              scriptContent: storyboards.scriptContent,
              frames: storyboards.frames,
              videoInfo: storyboards.videoInfo
            })
            .from(storyboards)
            .where(eq(storyboards.outlineId, activeOutlineId))
            .orderBy(asc(storyboards.sequence))
        : []

    return {
      storyId,
      activeOutlineId,
      outlines,
      episodes: outlines.map((o) => {
        const cnt = countByOutlineId.get(o.id) ?? 0
        return {
          id: o.id,
          sequence: o.sequence,
          name: `第${o.sequence}集`,
          status: cnt > 0 ? "completed" : "pending"
        }
      }),
      shots
    }
  }

  static async deleteStoryboards(userId: string, storyboardIds: string[], traceIdRaw?: string) {
    const traceId = traceIdRaw ?? "system"
    const db = await getDb({ stories, storyOutlines, storyboards })
    const requestedIds = Array.from(new Set(storyboardIds))

    const allowed = await db
      .select({
        id: storyboards.id,
        outlineId: storyboards.outlineId,
        storyId: stories.id
      })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(inArray(storyboards.id, requestedIds), eq(stories.userId, userId)))

    if (allowed.length === 0) return null

    const deleteIds = allowed.map((r) => r.id)
    const outlineIds = Array.from(new Set(allowed.map((r) => r.outlineId)))
    const storyIds = Array.from(new Set(allowed.map((r) => r.storyId)))

    logger.info({
      event: "video_storyboards_delete_exec",
      module: "video",
      traceId,
      message: "执行删除分镜",
      deleteCount: deleteIds.length
    })

    await db.delete(storyboards).where(inArray(storyboards.id, deleteIds))

    const now = new Date()
    for (const outlineId of outlineIds) {
      const remaining = await db
        .select({ id: storyboards.id })
        .from(storyboards)
        .where(eq(storyboards.outlineId, outlineId))
        .orderBy(asc(storyboards.sequence))

      for (let i = 0; i < remaining.length; i += 1) {
        const row = remaining[i]
        if (!row) continue
        await db
          .update(storyboards)
          .set({ sequence: i + 1, updatedAt: now })
          .where(eq(storyboards.id, row.id))
      }
    }

    for (const storyId of storyIds) {
      await updateStoryStatus(storyId, { metadataPatch: {}, traceId })
    }

    return { deletedIds: deleteIds, resequencedOutlineIds: outlineIds }
  }

  static async updateStoryboard(
    userId: string,
    params: {
      storyboardId: string
      storyboardText?: string
      scriptContent?: unknown
      frames?: {
        first?: { prompt?: string | null }
        last?: { prompt?: string | null }
      }
      videoInfo?: {
        prompt?: string | null
        durationSeconds?: number | null
        settings?: { mode?: string | null }
      }
    },
    traceIdRaw?: string
  ) {
    const traceId = traceIdRaw ?? "system"
    const { storyboardId, storyboardText, scriptContent, frames, videoInfo } = params
    const db = await getDb({ stories, storyOutlines, storyboards })

    const allowed = await db
      .select({ id: storyboards.id, storyId: stories.id, frames: storyboards.frames, videoInfo: storyboards.videoInfo })
      .from(storyboards)
      .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
      .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
      .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
      .limit(1)

    if (allowed.length === 0) return null
    const { storyId } = allowed[0]

    const updates: Partial<typeof storyboards.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() }

    if (storyboardText !== undefined) updates.storyboardText = storyboardText
    if (scriptContent !== undefined) {
      updates.scriptContent = scriptContent
      updates.isScriptGenerated = true
    }
    if (frames !== undefined) {
      const current = allowed[0]?.frames
      updates.frames = mergeStoryboardFrames(current as any, frames as any)
    }
    if (videoInfo !== undefined) {
      const current = allowed[0]?.videoInfo
      updates.videoInfo = mergeStoryboardVideoInfo(current as any, videoInfo as any)
    }

    await db.update(storyboards).set(updates).where(eq(storyboards.id, storyboardId))

    if (scriptContent !== undefined) {
      const allShots = await db
        .select({ isScriptGenerated: storyboards.isScriptGenerated })
        .from(storyboards)
        .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
        .where(eq(storyOutlines.storyId, storyId))

      const shotTotal = allShots.length
      const shotScriptDone = allShots.filter((s) => s.isScriptGenerated).length
      const isAllScriptsDone = shotScriptDone >= shotTotal && shotTotal > 0

      await updateStoryStatus(storyId, {
        status: isAllScriptsDone ? "ready" : "processing",
        progressStage: isAllScriptsDone ? "image_assets" : "video_script",
        metadataPatch: {
          progress: { shotTotal, shotScriptDone }
        },
        stageDetail: isAllScriptsDone
          ? { stage: "video_script", state: "success", durationMs: 0 }
          : { stage: "video_script", state: "processing" },
        traceId
      })
    }
    return params
  }
}
