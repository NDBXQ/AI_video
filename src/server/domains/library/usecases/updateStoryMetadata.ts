import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { stories } from "@/shared/schema"

export async function updateStoryMetadata(params: {
  userId: string
  storyId: string
  patch: Record<string, unknown>
}): Promise<{ storyId: string; metadata: Record<string, unknown> }> {
  const db = await getDb({ stories })
  const rows = await db
    .select({ metadata: stories.metadata })
    .from(stories)
    .where(and(eq(stories.id, params.storyId), eq(stories.userId, params.userId)))
    .limit(1)

  if (rows.length === 0) throw new Error("STORY_NOT_FOUND")

  const prev = (rows[0]?.metadata ?? {}) as Record<string, unknown>
  const next = { ...prev, ...params.patch } as Record<string, unknown>

  await db
    .update(stories)
    .set({ metadata: next, updatedAt: new Date() })
    .where(and(eq(stories.id, params.storyId), eq(stories.userId, params.userId)))

  return { storyId: params.storyId, metadata: next }
}
