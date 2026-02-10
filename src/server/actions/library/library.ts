"use server"

import { cookies } from "next/headers"
import { getDb } from "coze-coding-dev-sdk"
import { generatedImages } from "@/shared/schema/generation"
import { jobs } from "@/shared/schema/jobs"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { tvcStories } from "@/shared/schema/tvc"
import { desc, eq, and, inArray, like, sql } from "drizzle-orm"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { logger } from "@/shared/logger"
import type { LibraryItem } from "@/shared/contracts/library/libraryItem"
import type { StoryMetadata } from "@/shared/contracts/video/story"
import { z } from "zod"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

function mapProgressStageToLibraryType(progressStage: string | null | undefined): LibraryItem["type"] {
  if (progressStage === "video_assets" || progressStage === "done") return "video"
  if (progressStage === "storyboard_text" || progressStage === "video_script") return "storyboard"
  if (progressStage === "image_assets") return "material"
  return "draft"
}

export async function getMyStories(query?: string): Promise<LibraryItem[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  if (!token) return []

  const session = await verifySessionToken(token, traceId)
  if (!session) return []

  await ensureTvcSchema()

  const db = await getDb({ stories, storyOutlines, storyboards, tvcStories })

  const conditions = [eq(stories.userId, session.userId)]
  const normalizedQuery = query?.trim() ?? ""
  if (normalizedQuery) {
    conditions.push(like(stories.title, `%${normalizedQuery}%`))
  }

  logger.info({
    event: "library_my_stories_list_start",
    module: "library",
    traceId,
    message: "开始获取我的 stories 列表",
    hasQuery: Boolean(normalizedQuery)
  })

  const rows = await db
    .select()
    .from(stories)
    .where(and(...conditions))
    .orderBy(desc(stories.updatedAt))

  const items: Array<LibraryItem & { __sort: number }> = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as StoryMetadata
    const thumbnail = typeof metadata?.thumbnail === "string" ? metadata.thumbnail : undefined

    const sortMs = row.updatedAt ? new Date(row.updatedAt).getTime() : new Date(row.createdAt).getTime()
    const dateStr = row.updatedAt
      ? new Date(row.updatedAt)
          .toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          })
          .replace(/\//g, "-")
      : ""

    const type = mapProgressStageToLibraryType(row.progressStage)
    return {
      id: row.id,
      title: row.title || "未命名",
      type,
      updatedAt: dateStr,
      specs: `${row.aspectRatio} ｜ ${row.resolution}`,
      thumbnail,
      metadata,
      progressStage: row.progressStage,
      __sort: sortMs
    } satisfies LibraryItem & { __sort: number }
  })

  const tvcConditions = [eq(tvcStories.userId, session.userId)]
  if (normalizedQuery) {
    tvcConditions.push(like(tvcStories.title, `%${normalizedQuery}%`))
  }

  const tvcRows = await db
    .select()
    .from(tvcStories)
    .where(and(...tvcConditions))
    .orderBy(desc(sql`coalesce(${tvcStories.updatedAt}, ${tvcStories.createdAt})`))

  const tvcItems: Array<LibraryItem & { __sort: number }> = tvcRows.map((row) => {
    const sortMs = row.updatedAt ? new Date(row.updatedAt).getTime() : new Date(row.createdAt).getTime()
    const time = row.updatedAt ?? row.createdAt
    const dateStr = time
      ? new Date(time)
          .toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
          .replace(/\//g, "-")
      : ""
    return {
      id: row.id,
      title: (row.title ?? "").trim() || "未命名 TVC 项目",
      type: "tvc",
      updatedAt: dateStr,
      specs: `${row.aspectRatio} ｜ ${row.resolution}`,
      progressStage: row.progressStage,
      __sort: sortMs
    }
  })

  items.push(...tvcItems)

  const missingThumbnailStoryIds = items
    .filter((i) => i.type !== "tvc" && !i.thumbnail)
    .map((i) => i.id)
    .slice(0, 200)

  if (missingThumbnailStoryIds.length > 0) {
    const idsSql = sql.join(missingThumbnailStoryIds.map((id) => sql`${id}`), sql`,`)
    const res = await db.execute(sql`
      select distinct on (so.story_id)
        so.story_id as story_id,
        coalesce(sb.frames->'first'->>'thumbnailUrl', sb.frames->'first'->>'url') as thumbnail
      from story_outlines so
      join storyboards sb on sb.outline_id = so.id
      where so.story_id in (${idsSql})
      order by so.story_id, so.sequence asc, sb.sequence asc
    `)
    const firstFrameRows = ((res as unknown as { rows?: Array<{ story_id: string; thumbnail: string | null }> }).rows ?? (res as any)) as Array<{
      story_id: string
      thumbnail: string | null
    }>
    const thumbByStoryId = new Map<string, string>()
    for (const r of firstFrameRows) {
      const id = String((r as any).story_id ?? "").trim()
      const t = typeof (r as any).thumbnail === "string" ? String((r as any).thumbnail).trim() : ""
      if (id && t) thumbByStoryId.set(id, t)
    }
    for (const item of items) {
      if (item.thumbnail) continue
      const t = thumbByStoryId.get(item.id)
      if (t) item.thumbnail = t
    }
  }

  logger.info({
    event: "library_my_stories_list_success",
    module: "library",
    traceId,
    message: "获取我的 stories 列表成功",
    durationMs: Date.now() - start,
    total: items.length
  })

  return items
    .sort((a, b) => b.__sort - a.__sort)
    .map(({ __sort, ...rest }) => rest)
}

export async function getDraftStories(query?: string): Promise<LibraryItem[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const traceId = getTraceId(new Headers())

  if (!token) return []

  const session = await verifySessionToken(token, traceId)
  if (!session) return []

  const db = await getDb({ stories })

  const conditions = [eq(stories.userId, session.userId), eq(stories.status, "draft")]

  if (query && query.trim()) {
    conditions.push(like(stories.title, `%${query.trim()}%`))
  }

  const rows = await db.select().from(stories).where(and(...conditions)).orderBy(desc(stories.updatedAt))

  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as StoryMetadata
    const thumbnail = typeof metadata?.thumbnail === "string" ? metadata.thumbnail : undefined

    const dateStr = row.updatedAt
      ? new Date(row.updatedAt)
          .toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          })
          .replace(/\//g, "-")
      : ""

    return {
      id: row.id,
      title: row.title || "未命名草稿",
      type: "draft",
      updatedAt: dateStr,
      specs: `${row.aspectRatio} ${row.resolution}`,
      thumbnail,
      metadata,
      progressStage: row.progressStage
    }
  })
}

export async function deleteStory(storyId: string): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  if (!token) return { success: false }

  const session = await verifySessionToken(token, traceId)
  if (!session) return { success: false }

  logger.info({
    event: "library_story_delete_start",
    module: "library",
    traceId,
    message: "开始删除 story",
    storyId
  })

  const db = await getDb({ stories, storyOutlines, storyboards, generatedImages, jobs })
  const allowed = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, session.userId)))
    .limit(1)

  if (allowed.length === 0) return { success: false }

  const outlines = await db
    .select({ id: storyOutlines.id })
    .from(storyOutlines)
    .where(eq(storyOutlines.storyId, storyId))
  const outlineIds = outlines.map((o) => o.id)

  await db.delete(generatedImages).where(eq(generatedImages.storyId, storyId))
  await db.delete(jobs).where(eq(jobs.storyId, storyId))
  if (outlineIds.length > 0) {
    await db.delete(storyboards).where(inArray(storyboards.outlineId, outlineIds))
  }
  await db.delete(storyOutlines).where(eq(storyOutlines.storyId, storyId))
  await db.delete(stories).where(eq(stories.id, storyId))

  logger.info({
    event: "library_story_delete_success",
    module: "library",
    traceId,
    message: "删除 story 成功",
    durationMs: Date.now() - start,
    storyId
  })
  return { success: true }
}

const getStoryOriginalSchema = z.object({
  storyId: z.string().trim().min(1).max(200)
})

export async function getStoryOriginalContent(storyId: string): Promise<{
  success: boolean
  message?: string
  data?: { id: string; title: string; intro?: string; originalText: string }
}> {
  const parsed = getStoryOriginalSchema.safeParse({ storyId })
  if (!parsed.success) return { success: false, message: "参数不正确" }
  return { success: false, message: "该接口已下线，请使用“查看内容”弹窗" }
}
