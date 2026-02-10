import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"

export async function updateTvcImageAssetMeta(input: {
  userId: string
  storyId: string
  kind: "reference_image" | "first_frame"
  ordinal: number
  title: string
  description: string | null
}): Promise<
  | { ok: true }
  | { ok: false; code: string; message: string; status: number }
> {
  await ensureTvcSchema()
  const db = await getDb({ tvcAssets, tvcStories })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false, code: "NOT_FOUND", message: "项目不存在或无权限", status: 404 }

  const [row] = await db
    .select({ meta: tvcAssets.meta })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, input.storyId), eq(tvcAssets.kind, input.kind), eq(tvcAssets.assetOrdinal, input.ordinal)))
    .limit(1)
  if (!row) return { ok: false, code: "NOT_FOUND", message: "素材不存在", status: 404 }

  const existingMeta = (row.meta ?? {}) as Record<string, unknown>
  const nextMeta: Record<string, unknown> = {
    ...existingMeta,
    title: input.title,
    description: input.description
  }

  await db
    .update(tvcAssets)
    .set({ meta: nextMeta, updatedAt: new Date() } as any)
    .where(and(eq(tvcAssets.storyId, input.storyId), eq(tvcAssets.kind, input.kind), eq(tvcAssets.assetOrdinal, input.ordinal)))

  return { ok: true }
}
