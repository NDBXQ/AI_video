import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { tvcStories } from "@/shared/schema/tvc"

export async function updateTvcStoryStatus(
  storyId: string,
  params: {
    status?: string
    progressStage?: string
    metadataPatch?: Record<string, unknown>
    traceId?: string
  }
): Promise<void> {
  const { status, progressStage, metadataPatch } = params
  const db = await getDb({ tvcStories })

  const [current] = await db.select({ metadata: tvcStories.metadata }).from(tvcStories).where(eq(tvcStories.id, storyId)).limit(1)
  if (!current) return

  const base = (current.metadata ?? {}) as Record<string, unknown>
  const metadata = metadataPatch ? ({ ...base, ...metadataPatch } as any) : base

  await db
    .update(tvcStories)
    .set({
      ...(status ? { status } : {}),
      ...(progressStage ? { progressStage } : {}),
      ...(metadataPatch ? { metadata } : {}),
      updatedAt: new Date()
    })
    .where(eq(tvcStories.id, storyId))
}
