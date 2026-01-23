"use server"

import { cookies } from "next/headers"
import { getDb } from "coze-coding-dev-sdk"
import { generatedImages, jobs, stories, storyOutlines, storyboards } from "@/shared/schema"
import { desc, eq, and, inArray, like } from "drizzle-orm"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { logger } from "@/shared/logger"
import type { LibraryItem } from "../components/LibraryCard"
import type { StoryMetadata } from "@/features/video/types/story"
import { z } from "zod"

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

  const db = await getDb({ stories })

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

  const items = rows.map((row) => {
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

    const type = mapProgressStageToLibraryType(row.progressStage)
    return {
      id: row.id,
      title: row.title || "未命名",
      type,
      updatedAt: dateStr,
      specs: row.resolution,
      thumbnail,
      metadata,
      progressStage: row.progressStage
    } satisfies LibraryItem
  })

  logger.info({
    event: "library_my_stories_list_success",
    module: "library",
    traceId,
    message: "获取我的 stories 列表成功",
    durationMs: Date.now() - start,
    total: items.length
  })

  return items
}

export async function getDraftStories(query?: string): Promise<LibraryItem[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  // Server Action 中 headers() 是只读的，这里简单生成一个 traceId 用于内部逻辑
  const traceId = getTraceId(new Headers())

  if (!token) return []

  const session = await verifySessionToken(token, traceId)
  if (!session) return []

  const db = await getDb({ stories })
  
  const conditions = [
    eq(stories.userId, session.userId),
    eq(stories.status, "draft")
  ]

  if (query && query.trim()) {
     conditions.push(like(stories.title, `%${query.trim()}%`))
  }

  const rows = await db.select().from(stories)
    .where(and(...conditions))
    .orderBy(desc(stories.updatedAt))

  return rows.map(row => {
    // 尝试从 metadata 中获取缩略图，如果有的话
    const metadata = (row.metadata ?? {}) as StoryMetadata
    const thumbnail = typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : undefined

    // 格式化时间：YYYY-MM-DD HH:mm
    const dateStr = row.updatedAt 
      ? new Date(row.updatedAt).toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }).replace(/\//g, '-')
      : ""

    return {
      id: row.id,
      title: row.title || "未命名草稿",
      type: "draft",
      updatedAt: dateStr,
      specs: row.resolution,
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
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  const parsed = getStoryOriginalSchema.safeParse({ storyId })
  if (!parsed.success) return { success: false, message: "参数不正确" }

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return { success: false, message: "未登录或登录已过期" }

  const session = await verifySessionToken(token, traceId)
  if (!session) return { success: false, message: "未登录或登录已过期" }

  logger.info({
    event: "library_story_original_get_start",
    module: "library",
    traceId,
    message: "开始读取剧本原始内容",
    storyId
  })

  const db = await getDb({ stories })
  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      storyType: stories.storyType,
      storyText: stories.storyText,
      generatedText: stories.generatedText
    })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, session.userId)))
    .limit(1)

  if (rows.length === 0) return { success: false, message: "未找到剧本" }

  const row = rows[0]
  const originalText = (row.generatedText ?? row.storyText ?? "").trim()
  const intro = (row.storyType ?? "") === "brief" ? (row.storyText ?? "").trim() : ""

  logger.info({
    event: "library_story_original_get_success",
    module: "library",
    traceId,
    message: "读取剧本原始内容成功",
    durationMs: Date.now() - start,
    storyId,
    originalChars: originalText.length,
    introChars: intro.length
  })

  return {
    success: true,
    data: {
      id: row.id,
      title: row.title || "未命名",
      intro: intro || undefined,
      originalText
    }
  }
}
