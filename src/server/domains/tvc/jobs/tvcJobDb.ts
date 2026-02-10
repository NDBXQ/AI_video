import { and, asc, eq, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { tvcJobs } from "@/shared/schema"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

export type JobStatus = "queued" | "running" | "done" | "error"

export async function insertTvcJob(input: {
  jobId: string
  userId: string
  type: string
  status: JobStatus
  payload: Record<string, unknown>
  snapshot: Record<string, unknown>
}): Promise<void> {
  await ensureTvcSchema()
  const db = await getDb({ tvcJobs })
  await db.insert(tvcJobs).values({
    id: input.jobId,
    userId: input.userId,
    type: input.type,
    status: input.status,
    payload: input.payload,
    snapshot: input.snapshot,
    progressVersion: 0,
    updatedAt: new Date()
  })
}

export async function getTvcJobById(jobId: string): Promise<{
  userId: string
  type: string
  status: JobStatus
  payload: Record<string, unknown>
  snapshot: Record<string, unknown>
  progressVersion: number
} | null> {
  await ensureTvcSchema()
  const db = await getDb({ tvcJobs })
  const rows = await db
    .select({
      userId: tvcJobs.userId,
      type: tvcJobs.type,
      status: tvcJobs.status,
      payload: tvcJobs.payload,
      snapshot: tvcJobs.snapshot,
      progressVersion: tvcJobs.progressVersion
    })
    .from(tvcJobs)
    .where(eq(tvcJobs.id, jobId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    userId: row.userId,
    type: row.type,
    status: row.status as JobStatus,
    payload: row.payload as Record<string, unknown>,
    snapshot: row.snapshot as Record<string, unknown>,
    progressVersion: row.progressVersion
  }
}

export async function updateTvcJob(jobId: string, patch: { status: JobStatus; snapshot: Record<string, unknown>; errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await ensureTvcSchema()
  const db = await getDb({ tvcJobs })
  await db
    .update(tvcJobs)
    .set({
      status: patch.status,
      snapshot: patch.snapshot,
      errorMessage: patch.errorMessage ?? null,
      finishedAt: patch.finished ? new Date() : undefined,
      updatedAt: new Date(),
      progressVersion: sql`${tvcJobs.progressVersion} + 1`
    })
    .where(eq(tvcJobs.id, jobId))
}

export async function tryClaimNextTvcJob(type: string): Promise<{ jobId: string; payload: Record<string, unknown>; snapshot: Record<string, unknown> } | null> {
  await ensureTvcSchema()
  const db = await getDb({ tvcJobs })

  const next = await db
    .select({ id: tvcJobs.id, payload: tvcJobs.payload, snapshot: tvcJobs.snapshot })
    .from(tvcJobs)
    .where(and(eq(tvcJobs.type, type), eq(tvcJobs.status, "queued")))
    .orderBy(asc(tvcJobs.createdAt))
    .limit(1)

  const candidate = next[0]
  if (!candidate?.id) return null

  const [claimed] = await db
    .update(tvcJobs)
    .set({
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
      progressVersion: sql`${tvcJobs.progressVersion} + 1`,
      snapshot: sql`jsonb_set(${tvcJobs.snapshot}, '{status}', to_jsonb('running'::text), true)`
    })
    .where(and(eq(tvcJobs.id, candidate.id), eq(tvcJobs.status, "queued")))
    .returning({ id: tvcJobs.id, payload: tvcJobs.payload, snapshot: tvcJobs.snapshot })

  if (!claimed?.id) return null
  return {
    jobId: claimed.id,
    payload: claimed.payload as Record<string, unknown>,
    snapshot: claimed.snapshot as Record<string, unknown>
  }
}
