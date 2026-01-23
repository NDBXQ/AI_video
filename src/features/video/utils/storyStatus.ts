import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories } from "@/shared/schema"
import { logger } from "@/shared/logger"
import type { StoryMetadata, StoryProgressStage, StoryStatus, StageState, StageStatusDetail } from "../types/story"

export async function updateStoryStatus(
  storyId: string,
  params: {
    status?: StoryStatus
    progressStage?: StoryProgressStage
    metadataPatch?: Partial<StoryMetadata>
    stageDetail?: {
      stage: StoryProgressStage
      state: StageState
      durationMs?: number
      errorCode?: string
      errorMessage?: string
    }
    traceId?: string
  }
) {
  const { status, progressStage, metadataPatch, stageDetail, traceId } = params
  const db = await getDb({ stories })

  // 1. Fetch current story to merge metadata
  const [current] = await db
    .select({ metadata: stories.metadata })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1)

  if (!current) {
    logger.warn({
      event: "update_story_status_not_found",
      module: "video",
      storyId,
      traceId: traceId ?? "",
      message: "更新状态失败：Story 不存在"
    })
    return
  }

  let metadata = (current.metadata ?? {}) as StoryMetadata

  // 2. Merge general metadata patch
  if (metadataPatch) {
    metadata = {
      ...metadata,
      ...metadataPatch,
      stageStatus: {
        ...(metadata.stageStatus ?? {}),
        ...(metadataPatch.stageStatus ?? {})
      },
      progress: {
        ...(metadata.progress ?? {}),
        ...(metadataPatch.progress ?? {})
      }
    }
  }

  // 3. Handle specific stage status update
  if (stageDetail) {
    const { stage, state, durationMs, errorCode, errorMessage } = stageDetail
    const now = new Date().toISOString()
    const existingStage = metadata.stageStatus?.[stage] ?? { state: "idle" }
    
    const newStage: StageStatusDetail = {
      ...existingStage,
      state,
    }

    if (state === "processing") {
      newStage.startedAt = now
      delete newStage.finishedAt
      delete newStage.durationMs
      delete newStage.errorCode
      delete newStage.errorMessage
    } else if (state === "success" || state === "failed" || state === "canceled") {
      newStage.finishedAt = now
      if (durationMs !== undefined) newStage.durationMs = durationMs
      if (errorCode) newStage.errorCode = errorCode
      if (errorMessage) newStage.errorMessage = errorMessage
    }

    metadata = {
      ...metadata,
      stageStatus: {
        ...(metadata.stageStatus ?? {}),
        [stage]: newStage
      }
    }

    if (state === "failed" && errorMessage) {
      metadata.lastError = {
        stage,
        code: errorCode,
        message: errorMessage,
        at: now,
        traceId
      }
    }
  }

  // 4. Update DB
  await db
    .update(stories)
    .set({
      ...(status ? { status } : {}),
      ...(progressStage ? { progressStage } : {}),
      metadata,
      updatedAt: new Date()
    })
    .where(eq(stories.id, storyId))

  logger.info({
    event: "update_story_status_success",
    module: "video",
    storyId,
    traceId: traceId ?? "",
    message: "更新 Story 状态成功",
    status,
    progressStage,
    stage: stageDetail?.stage,
    state: stageDetail?.state
  })
}
