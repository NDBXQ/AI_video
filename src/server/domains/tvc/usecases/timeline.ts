import { getDb } from "coze-coding-dev-sdk"
import { eq } from "drizzle-orm"
import { tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

export async function getTvcProjectTimeline(input: { userId: string; storyId: string }): Promise<{ ok: boolean; timeline?: unknown }> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const [story] = await db.select({ userId: tvcStories.userId, metadata: tvcStories.metadata }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false }
  const metadata = (story.metadata ?? {}) as any
  return { ok: true, timeline: metadata?.timeline ?? null }
}

export async function persistTvcProjectTimeline(input: {
  userId: string
  storyId: string
  timeline: unknown
}): Promise<{ ok: boolean }> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const [story] = await db.select({ userId: tvcStories.userId, metadata: tvcStories.metadata }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false }

  const prev = (story.metadata ?? {}) as Record<string, unknown>
  const next = { ...prev, timeline: input.timeline } as any
  await db.update(tvcStories).set({ metadata: next, updatedAt: new Date() }).where(eq(tvcStories.id, input.storyId))
  return { ok: true }
}
