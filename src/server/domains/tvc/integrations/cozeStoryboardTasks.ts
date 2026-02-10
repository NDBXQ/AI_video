import { and, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { readEnv } from "@/shared/env"
import { callCozeRunEndpoint } from "@/features/coze/runEndpointClient"
import { tvcStories, tvcStoryOutlines, tvcStoryboards } from "@/shared/schema"
import { updateTvcStoryStatus } from "@/server/db/updateTvcStoryStatus"

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

export async function runGenerateTvcOutline(input: {
  traceId: string
  userId: string
  storyId: string
  input_type: string
  story_text: string
  ratio?: string
  resolution?: string
}): Promise<{ storyId: string; coze: unknown; outlineTotal: number; durationMs: number; cozeStatus: number }> {
  const start = Date.now()
  const url = readEnv("OUTLINE_API_URL")
  const token = readEnv("OUTLINE_API_TOKEN")
  if (!url || !token) throw new Error("COZE_NOT_CONFIGURED")

  const db = await getDb({ tvcStories, tvcStoryOutlines, tvcStoryboards })
  const coze = await callCozeRunEndpoint({
    traceId: input.traceId,
    url,
    token,
    body: { input_type: input.input_type, story_text: input.story_text },
    module: "coze"
  })

  const ratio = input.ratio?.trim() || "16:9"
  const resolution = input.resolution?.trim() || "1080p"
  const storyType = input.input_type
  const storyText = input.story_text
  const storyOriginalPersist = extractStoryOriginal(coze.data) ?? (storyType === "original" ? storyText : null)

  const [existing] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId })
    .from(tvcStories)
    .where(eq(tvcStories.id, input.storyId))
    .limit(1)
  if (!existing) throw new Error("STORY_NOT_FOUND")
  if (existing.userId !== input.userId) throw new Error("FORBIDDEN")

  await db
    .update(tvcStories)
    .set({
      storyType,
      resolution,
      aspectRatio: ratio,
      storyText,
      generatedText: storyOriginalPersist ?? undefined,
      updatedAt: new Date()
    })
    .where(eq(tvcStories.id, input.storyId))

  await updateTvcStoryStatus(input.storyId, { status: "processing", progressStage: "outline", traceId: input.traceId })

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
    await db.delete(tvcStoryOutlines).where(eq(tvcStoryOutlines.storyId, input.storyId))

    await db.insert(tvcStoryOutlines).values(
      list.map((item, idx) => {
        return {
          storyId: input.storyId,
          sequence: idx + 1,
          outlineText: String(item.outline ?? ""),
          originalText: String(item.original ?? "")
        }
      })
    )
  }

  await updateTvcStoryStatus(input.storyId, {
    status: "ready",
    progressStage: "storyboard_text",
    metadataPatch: { progress: { outlineTotal: list.length } },
    traceId: input.traceId
  })

  return { storyId: input.storyId, coze: coze.data, outlineTotal: list.length, durationMs: Date.now() - start, cozeStatus: coze.status }
}

export async function runGenerateTvcStoryboardText(input: {
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

  const db = await getDb({ tvcStories, tvcStoryOutlines, tvcStoryboards })

  const [outlineRow] = await db.select({ storyId: tvcStoryOutlines.storyId }).from(tvcStoryOutlines).where(eq(tvcStoryOutlines.id, input.outlineId)).limit(1)
  if (!outlineRow?.storyId) throw new Error("OUTLINE_NOT_FOUND")

  const [storyRow] = await db.select({ userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, outlineRow.storyId)).limit(1)
  if (!storyRow?.userId || storyRow.userId !== input.userId) throw new Error("OUTLINE_NOT_FOUND")

  const storyId = outlineRow.storyId

  await updateTvcStoryStatus(storyId, { status: "processing", progressStage: "storyboard_text", traceId: input.traceId })

  const existingRows = await db.select({ id: tvcStoryboards.id }).from(tvcStoryboards).where(eq(tvcStoryboards.outlineId, input.outlineId))
  if (existingRows.length > 0) {
    const idsToDelete = existingRows.map((row) => row.id)
    await db.delete(tvcStoryboards).where(inArray(tvcStoryboards.id, idsToDelete))
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
    await db.insert(tvcStoryboards).values({
      outlineId: input.outlineId,
      sequence: seq,
      shotCut,
      storyboardText
    })
  }

  const allOutlines = await db.select({ id: tvcStoryOutlines.id }).from(tvcStoryOutlines).where(eq(tvcStoryOutlines.storyId, storyId))
  const allOutlineIds = allOutlines.map((o) => o.id)
  const outlineWithShots = await db
    .select({ outlineId: tvcStoryboards.outlineId })
    .from(tvcStoryboards)
    .where(inArray(tvcStoryboards.outlineId, allOutlineIds))
    .groupBy(tvcStoryboards.outlineId)

  const outlineStoryboardDone = outlineWithShots.length
  const shotTotal =
    (await db
      .select({ count: sql<number>`count(*)` })
      .from(tvcStoryboards)
      .where(inArray(tvcStoryboards.outlineId, allOutlineIds)))[0].count ?? 0

  const isAllOutlinesDone = outlineStoryboardDone >= allOutlineIds.length

  await updateTvcStoryStatus(storyId, {
    status: isAllOutlinesDone ? "ready" : "processing",
    progressStage: isAllOutlinesDone ? "video_script" : "storyboard_text",
    metadataPatch: { progress: { outlineStoryboardDone, shotTotal: Number(shotTotal) } },
    traceId: input.traceId
  })

  return { coze: coze.data, persistedTotal: storyboardList.length, durationMs: Date.now() - start, storyId, cozeStatus: coze.status }
}
