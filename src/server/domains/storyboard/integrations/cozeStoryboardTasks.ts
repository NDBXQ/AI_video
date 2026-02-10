import "server-only"

import { and, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/shared/env"
import { callCozeRunEndpoint } from "@/features/coze/runEndpointClient"
import { updateStoryStatus } from "@/features/video/utils/storyStatus"
import { stories, storyOutlines, storyboards, type StoryboardScriptContent } from "@/shared/schema/story"
import { normalizeShotStyleId } from "@/shared/shotStyle"
import { mergeStoryboardVideoInfo } from "@/server/shared/storyboard/storyboardAssets"

function extractStoryOriginal(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const anyData = data as Record<string, unknown>
  const direct = anyData["story_original"]
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  const nested = anyData["data"]
  if (nested && typeof nested === "object") {
    const nestedAny = nested as Record<string, unknown>
    const v = nestedAny["story_original"]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

export async function runGenerateOutline(input: {
  traceId: string
  userId: string
  storyId?: string
  input_type: string
  story_text: string
  title?: string
  ratio?: string
  resolution?: string
  style?: string
}): Promise<{ storyId: string; coze: unknown; outlineTotal: number; durationMs: number; cozeStatus: number }> {
  const start = Date.now()
  const url = readEnv("OUTLINE_API_URL")
  const token = readEnv("OUTLINE_API_TOKEN")
  if (!url || !token) throw new Error("COZE_NOT_CONFIGURED")

  const db = await getDb({ stories, storyOutlines, storyboards })
  const coze = await callCozeRunEndpoint({
    traceId: input.traceId,
    url,
    token,
    body: { input_type: input.input_type, story_text: input.story_text },
    module: "coze"
  })

  const ratio = input.ratio?.trim() || "16:9"
  const resolution = input.resolution?.trim() || "1080p"
  const title = input.title?.trim() || null
  const shotStyle = normalizeShotStyleId(input.style)
  const storyType = input.input_type
  const storyText = input.story_text
  const storyOriginalPersist =
    extractStoryOriginal(coze.data) ?? (storyType === "original" ? storyText : null)

  let story: { id: string }
  if (input.storyId) {
    const [existing] = await db
      .select({ id: stories.id, userId: stories.userId })
      .from(stories)
      .where(eq(stories.id, input.storyId))
      .limit(1)
    if (!existing) throw new Error("STORY_NOT_FOUND")
    if (existing.userId !== input.userId) throw new Error("FORBIDDEN")

    await db
      .update(stories)
      .set({
        title: title ?? undefined,
        storyType,
        resolution,
        aspectRatio: ratio,
        storyText,
        generatedText: storyOriginalPersist ?? undefined,
        shotStyle,
        updatedAt: new Date()
      })
      .where(eq(stories.id, input.storyId))
    story = { id: input.storyId }
  } else {
    const [newStory] = await db
      .insert(stories)
      .values({
        userId: input.userId,
        title,
        storyType,
        resolution,
        aspectRatio: ratio,
        storyText,
        generatedText: storyOriginalPersist,
        shotStyle
      })
      .returning()
    story = newStory
  }

  await updateStoryStatus(story.id, {
    status: "processing",
    progressStage: "outline",
    stageDetail: { stage: "outline", state: "processing" },
    traceId: input.traceId
  })

  const outlineData = coze.data as unknown
  const list =
    typeof outlineData === "object" &&
    outlineData !== null &&
    "outline_original_list" in outlineData &&
    Array.isArray((outlineData as { outline_original_list?: unknown }).outline_original_list)
      ? ((outlineData as { outline_original_list: Array<{ outline?: unknown; original?: unknown }> })
          .outline_original_list as Array<{ outline?: unknown; original?: unknown }>)
      : []

  if (list.length > 0) {
    if (input.storyId) {
      await db.delete(storyOutlines).where(eq(storyOutlines.storyId, input.storyId))
    }

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

  await updateStoryStatus(story.id, {
    status: "ready",
    progressStage: "storyboard_text",
    metadataPatch: { progress: { outlineTotal: list.length } },
    stageDetail: { stage: "outline", state: "success", durationMs: Date.now() - start },
    traceId: input.traceId
  })

  return { storyId: story.id, coze: coze.data, outlineTotal: list.length, durationMs: Date.now() - start, cozeStatus: coze.status }
}

export async function runGenerateStoryboardText(input: {
  traceId: string
  userId: string
  outlineId: string
  outline: string
  original: string
}): Promise<{ coze: unknown; persistedTotal: number; durationMs: number; storyId: string; cozeStatus: number }> {
  const start = Date.now()
  const url = readEnv("CREATE_STORYBOARD_TEXT_URL")
  const token = readEnv("CREATE_STORYBOARD_TEXT_TOKEN")
  if (!url || !token) throw new Error("COZE_NOT_CONFIGURED")

  const db = await getDb({ stories, storyOutlines, storyboards })

  const [outlineRow] = await db
    .select({ storyId: storyOutlines.storyId })
    .from(storyOutlines)
    .where(eq(storyOutlines.id, input.outlineId))
    .limit(1)
  if (!outlineRow?.storyId) throw new Error("OUTLINE_NOT_FOUND")

  const [storyRow] = await db
    .select({ userId: stories.userId })
    .from(stories)
    .where(eq(stories.id, outlineRow.storyId))
    .limit(1)
  if (!storyRow?.userId || storyRow.userId !== input.userId) throw new Error("OUTLINE_NOT_FOUND")

  const storyId = outlineRow.storyId

  await updateStoryStatus(storyId, {
    status: "processing",
    progressStage: "storyboard_text",
    stageDetail: { stage: "storyboard_text", state: "processing" },
    traceId: input.traceId
  })

  const existingRows = await db.select({ id: storyboards.id }).from(storyboards).where(eq(storyboards.outlineId, input.outlineId))
  if (existingRows.length > 0) {
    const idsToDelete = existingRows.map((row) => row.id)
    await db.delete(storyboards).where(inArray(storyboards.id, idsToDelete))
  }

  const coze = await callCozeRunEndpoint({
    traceId: input.traceId,
    url,
    token,
    body: { outline: input.outline, original: input.original },
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

  for (let i = 0; i < storyboardList.length; i += 1) {
    const item = storyboardList[i]
    const seq = i + 1
    const shotCut = Boolean(item?.shot_cut)
    const storyboardText = String(item?.storyboard_text ?? "")
    await db.insert(storyboards).values({
      outlineId: input.outlineId,
      sequence: seq,
      sceneTitle: input.outline,
      originalText: input.original,
      shotCut,
      storyboardText
    })
  }

  const allOutlines = await db.select({ id: storyOutlines.id }).from(storyOutlines).where(eq(storyOutlines.storyId, storyId))
  const allOutlineIds = allOutlines.map((o) => o.id)
  const outlineWithShots = await db
    .select({ outlineId: storyboards.outlineId })
    .from(storyboards)
    .where(inArray(storyboards.outlineId, allOutlineIds))
    .groupBy(storyboards.outlineId)

  const outlineStoryboardDone = outlineWithShots.length
  const shotTotal =
    (await db
      .select({ count: sql<number>`count(*)` })
      .from(storyboards)
      .where(inArray(storyboards.outlineId, allOutlineIds)))[0].count ?? 0

  const isAllOutlinesDone = outlineStoryboardDone >= allOutlineIds.length

  await updateStoryStatus(storyId, {
    status: isAllOutlinesDone ? "ready" : "processing",
    progressStage: isAllOutlinesDone ? "video_script" : "storyboard_text",
    metadataPatch: {
      progress: {
        outlineStoryboardDone,
        shotTotal: Number(shotTotal)
      }
    },
    stageDetail: { stage: "storyboard_text", state: "success", durationMs: Date.now() - start },
    traceId: input.traceId
  })

  return { coze: coze.data, persistedTotal: storyboardList.length, durationMs: Date.now() - start, storyId, cozeStatus: coze.status }
}

function extractVideoScriptFromCozeData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  const anyData = data as Record<string, unknown>
  const directVideoScriptLike = anyData["shot_content"]
  if (directVideoScriptLike && typeof directVideoScriptLike === "object") return anyData
  const direct = anyData["video_script"]
  if (direct && typeof direct === "object") return direct as Record<string, unknown>

  const nested = anyData["data"]
  if (nested && typeof nested === "object") {
    const nestedAny = nested as Record<string, unknown>
    const videoScript = nestedAny["video_script"]
    if (videoScript && typeof videoScript === "object") return videoScript as Record<string, unknown>
  }

  return null
}

function sanitizeScriptContentForDb(cozeData: unknown): unknown {
  const videoScript = extractVideoScriptFromCozeData(cozeData)
  if (videoScript) return videoScript
  if (!cozeData || typeof cozeData !== "object") return cozeData
  const anyData = cozeData as Record<string, unknown>
  const { run_id: _runId, video_script: _videoScript, ...rest } = anyData
  return rest
}

function extractVideoDurationSeconds(cozeData: unknown): number | null {
  const videoScript = extractVideoScriptFromCozeData(cozeData)
  if (!videoScript) return null

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
  }

  const anyVideoScript = videoScript as Record<string, unknown>
  const shotInfo = anyVideoScript["shot_info"]
  const anyShotInfo = shotInfo && typeof shotInfo === "object" ? (shotInfo as Record<string, unknown>) : {}
  const fromShotInfo = anyShotInfo["shot_duration"]
  const shotInfoDur = toNumber(fromShotInfo)
  if (shotInfoDur && shotInfoDur > 0) return Math.trunc(shotInfoDur)

  const shot = anyVideoScript["shot"]
  const anyShot = shot && typeof shot === "object" ? (shot as Record<string, unknown>) : {}
  const fromShot = anyShot["shot_duration"]
  const shotDur = toNumber(fromShot)
  if (shotDur && shotDur > 0) return Math.trunc(shotDur)

  return null
}

export async function runGenerateScript(input: {
  traceId: string
  raw_script: string
  demand: string
  storyboardId?: string
}): Promise<{ coze: unknown; durationMs: number; cozeStatus: number }> {
  const start = Date.now()
  const url = readEnv("SCRIPT_API_URL")
  const token = readEnv("SCRIPT_API_TOKEN")
  if (!url || !token) throw new Error("COZE_NOT_CONFIGURED")

  const coze = await callCozeRunEndpoint({
    traceId: input.traceId,
    url,
    token,
    body: { raw_script: input.raw_script, demand: input.demand, storyboardId: input.storyboardId },
    module: "coze"
  })

  if (input.storyboardId) {
    const db = await getDb({ storyboards })
    const durationSeconds = extractVideoDurationSeconds(coze.data)
    const existing = await db
      .select({ videoInfo: storyboards.videoInfo })
      .from(storyboards)
      .where(eq(storyboards.id, input.storyboardId))
      .limit(1)
    const nextVideoInfo = mergeStoryboardVideoInfo(existing[0]?.videoInfo as any, { durationSeconds })
    await db
      .update(storyboards)
      .set({
        scriptContent: sanitizeScriptContentForDb(coze.data) as StoryboardScriptContent,
        isScriptGenerated: true,
        videoInfo: nextVideoInfo as any,
        updatedAt: new Date()
      })
      .where(eq(storyboards.id, input.storyboardId))
  }

  return { coze: coze.data, durationMs: Date.now() - start, cozeStatus: coze.status }
}
