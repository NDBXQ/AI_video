import "server-only"

import { and, asc, eq, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { jobs } from "@/shared/schema/jobs"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { ensureJobsTable } from "@/server/db/ensureJobsTable"

export type JobStatus = "queued" | "running" | "done" | "error"

export async function insertJob(input: {
  jobId: string
  userId: string
  type: string
  status: JobStatus
  storyId?: string | null
  storyboardId?: string | null
  payload: Record<string, unknown>
  snapshot: Record<string, unknown>
}): Promise<void> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  await db.insert(jobs).values({
    id: input.jobId,
    userId: input.userId,
    type: input.type,
    status: input.status,
    storyId: input.storyId ?? null,
    storyboardId: input.storyboardId ?? null,
    payload: input.payload,
    snapshot: input.snapshot,
    progressVersion: 0,
    updatedAt: new Date()
  })
}

export async function getJobById(jobId: string): Promise<{
  userId: string
  type: string
  status: JobStatus
  payload: Record<string, unknown>
  snapshot: Record<string, unknown>
  progressVersion: number
} | null> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  const rows = await db
    .select({
      userId: jobs.userId,
      type: jobs.type,
      status: jobs.status,
      payload: jobs.payload,
      snapshot: jobs.snapshot,
      progressVersion: jobs.progressVersion
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
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

export async function updateJob(jobId: string, patch: { status: JobStatus; snapshot: Record<string, unknown>; errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  await db
    .update(jobs)
    .set({
      status: patch.status,
      snapshot: patch.snapshot,
      errorMessage: patch.errorMessage ?? null,
      finishedAt: patch.finished ? new Date() : undefined,
      updatedAt: new Date(),
      progressVersion: sql`${jobs.progressVersion} + 1`
    })
    .where(eq(jobs.id, jobId))
}

export async function tryClaimNextJob(type: string): Promise<{ jobId: string; payload: Record<string, unknown>; snapshot: Record<string, unknown> } | null> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })

  const next = await db
    .select({ id: jobs.id, payload: jobs.payload, snapshot: jobs.snapshot })
    .from(jobs)
    .where(and(eq(jobs.type, type), eq(jobs.status, "queued")))
    .orderBy(asc(jobs.createdAt))
    .limit(1)

  const candidate = next[0]
  if (!candidate?.id) return null

  const [claimed] = await db
    .update(jobs)
    .set({
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
      progressVersion: sql`${jobs.progressVersion} + 1`,
      snapshot: sql`jsonb_set(${jobs.snapshot}, '{status}', to_jsonb('running'::text), true)`
    })
    .where(and(eq(jobs.id, candidate.id), eq(jobs.status, "queued")))
    .returning({ id: jobs.id, payload: jobs.payload, snapshot: jobs.snapshot })

  if (!claimed?.id) return null
  return {
    jobId: claimed.id,
    payload: claimed.payload as Record<string, unknown>,
    snapshot: claimed.snapshot as Record<string, unknown>
  }
}

export async function listJobsByStory(input: {
  userId: string
  storyId: string
  activeOnly: boolean
  limit: number
}): Promise<Array<{ jobId: string; type: string; status: JobStatus; progressVersion: number; snapshot: Record<string, unknown> }>> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })

  const where = input.activeOnly
    ? and(eq(jobs.userId, input.userId), eq(jobs.storyId, input.storyId), sql`${jobs.status} in ('queued','running')`)
    : and(eq(jobs.userId, input.userId), eq(jobs.storyId, input.storyId))

  const rows = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      progressVersion: jobs.progressVersion,
      snapshot: jobs.snapshot
    })
    .from(jobs)
    .where(where)
    .orderBy(sql`${jobs.updatedAt} desc`)
    .limit(input.limit)

  return rows.map((r) => ({
    jobId: r.id,
    type: r.type,
    status: r.status as JobStatus,
    progressVersion: r.progressVersion,
    snapshot: r.snapshot as Record<string, unknown>
  }))
}
