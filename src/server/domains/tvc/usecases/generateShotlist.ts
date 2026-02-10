import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { enqueueTvcGenerateShotlistJob, kickTvcShotlistWorker } from "@/server/domains/tvc/jobs/tvcShotlistWorker"

function mergeMetadata(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {}
  return { ...base, ...patch }
}

export async function generateTvcProjectShotlist(input: {
  traceId: string
  userId: string
  storyId: string
  brief: string
  durationSec: number
  aspectRatio?: string
  resolution?: string
}): Promise<
  | { ok: true; jobId: string; status: string; httpStatus: 202 }
  | { ok: false; code: string; message: string; status: number }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const [row] = await db
    .select({
      id: tvcStories.id,
      userId: tvcStories.userId,
      storyType: tvcStories.storyType,
      metadata: tvcStories.metadata
    })
    .from(tvcStories)
    .where(eq(tvcStories.id, input.storyId))
    .limit(1)

  if (!row || row.userId !== input.userId || row.storyType !== "tvc") {
    return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }
  }

  const brief = input.brief.trim()
  const aspectRatio = input.aspectRatio?.trim()
  const resolution = input.resolution?.trim()

  const nextMetadata = mergeMetadata(row.metadata, {
    tvc: mergeMetadata((row.metadata as any)?.tvc, {
      brief,
      durationSec: input.durationSec,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(resolution ? { resolution } : {})
    })
  })

  await db
    .update(tvcStories)
    .set({
      storyText: brief || "TVC brief",
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(resolution ? { resolution } : {}),
      metadata: nextMetadata as any,
      updatedAt: new Date()
    })
    .where(and(eq(tvcStories.id, row.id), eq(tvcStories.userId, input.userId)))

  const { jobId, snapshot } = await enqueueTvcGenerateShotlistJob({
    userId: input.userId,
    traceId: input.traceId,
    storyId: row.id,
    brief,
    durationSec: input.durationSec,
    ratio: aspectRatio,
    resolution
  })

  kickTvcShotlistWorker()

  return { ok: true, jobId, status: snapshot.status, httpStatus: 202 }
}
