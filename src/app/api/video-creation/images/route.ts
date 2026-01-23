import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

const querySchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  storyboardIds: z.string().trim().min(1).max(4000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  includeGlobal: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    storyId: url.searchParams.get("storyId") ?? undefined,
    storyboardId: url.searchParams.get("storyboardId") ?? undefined,
    storyboardIds: url.searchParams.get("storyboardIds") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    includeGlobal: url.searchParams.get("includeGlobal") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyId: rawStoryId, storyboardId, storyboardIds, category, includeGlobal, limit, offset } = parsed.data
  if (!rawStoryId && !storyboardId && !storyboardIds) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "必须提供 storyId 或 storyboardId"), { status: 400 })
  }

  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

  const effectiveStoryId =
    rawStoryId ??
    (
      storyboardId
        ? (
            await db
              .select({ storyId: stories.id })
              .from(storyboards)
              .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
              .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
              .where(and(eq(storyboards.id, storyboardId), eq(stories.userId, userId)))
              .limit(1)
          )[0]?.storyId ?? null
        : null
    )

  if (!effectiveStoryId) {
    return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })
  }

  const allowed = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, effectiveStoryId), eq(stories.userId, userId)))
    .limit(1)
  if (allowed.length === 0) return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })

  const conditions = [eq(generatedImages.storyId, effectiveStoryId)]
  if (storyboardId) conditions.push(eq(generatedImages.storyboardId, storyboardId))
  if (storyboardIds) {
    const ids = storyboardIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200)
    if (ids.length > 0) {
      const match = inArray(generatedImages.storyboardId, ids)
      const cond = includeGlobal ? or(match, isNull(generatedImages.storyboardId)) : match
      if (cond) conditions.push(cond)
    }
  }
  if (category) conditions.push(eq(generatedImages.category, category))

  const rows = await db
    .select({
      id: generatedImages.id,
      storyId: generatedImages.storyId,
      storyboardId: generatedImages.storyboardId,
      name: generatedImages.name,
      description: generatedImages.description,
      url: generatedImages.url,
      storageKey: generatedImages.storageKey,
      thumbnailUrl: generatedImages.thumbnailUrl,
      thumbnailStorageKey: generatedImages.thumbnailStorageKey,
      category: generatedImages.category,
      prompt: generatedImages.prompt,
      createdAt: generatedImages.createdAt
    })
    .from(generatedImages)
    .where(and(...conditions))
    .orderBy(desc(generatedImages.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json(makeApiOk(traceId, { storyId: effectiveStoryId, items: rows, limit, offset }), { status: 200 })
}
