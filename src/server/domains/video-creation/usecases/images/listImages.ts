import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"

export async function listVideoCreationImages(input: {
  userId: string
  storyId?: string
  storyboardId?: string
  storyboardIds?: string
  category?: string
  includeGlobal: boolean
  limit: number
  offset: number
}): Promise<
  | {
      ok: true
      storyId: string
      items: Array<{
        id: string
        storyId: string
        storyboardId: string | null
        name: string
        description: string | null
        url: string
        storageKey: string | null
        thumbnailUrl: string | null
        thumbnailStorageKey: string | null
        category: string
        prompt: string | null
        createdAt: Date
      }>
      limit: number
      offset: number
    }
  | { ok: false; code: "STORY_NOT_FOUND"; message: string; status: 404 }
> {
  const db = await getDb({ generatedImages, stories, storyOutlines, storyboards })

  const effectiveStoryId =
    input.storyId ??
    (input.storyboardId
      ? (
          await db
            .select({ storyId: stories.id })
            .from(storyboards)
            .innerJoin(storyOutlines, eq(storyboards.outlineId, storyOutlines.id))
            .innerJoin(stories, eq(storyOutlines.storyId, stories.id))
            .where(and(eq(storyboards.id, input.storyboardId), eq(stories.userId, input.userId)))
            .limit(1)
        )[0]?.storyId ?? null
      : null)

  if (!effectiveStoryId) {
    return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }
  }

  const allowed = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, effectiveStoryId), eq(stories.userId, input.userId)))
    .limit(1)
  if (allowed.length === 0) return { ok: false, code: "STORY_NOT_FOUND", message: "未找到可用的故事", status: 404 }

  const conditions = [eq(generatedImages.storyId, effectiveStoryId)]
  if (input.storyboardId) conditions.push(eq(generatedImages.storyboardId, input.storyboardId))
  if (input.storyboardIds) {
    const ids = input.storyboardIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200)
    if (ids.length > 0) {
      const match = inArray(generatedImages.storyboardId, ids)
      const cond = input.includeGlobal ? or(match, isNull(generatedImages.storyboardId)) : match
      if (cond) conditions.push(cond)
    }
  }
  if (input.category) conditions.push(eq(generatedImages.category, input.category))

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
    .limit(input.limit)
    .offset(input.offset)

  return { ok: true, storyId: effectiveStoryId, items: rows, limit: input.limit, offset: input.offset }
}

