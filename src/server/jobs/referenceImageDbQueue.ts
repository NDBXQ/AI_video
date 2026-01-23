import { and, asc, eq, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { jobs, generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"
import { ensureJobsTable } from "@/server/db/ensureJobsTable"

export type ReferenceImageJobStatus = "queued" | "running" | "done" | "error"

export type ReferenceImageJobSnapshot = {
  jobId: string
  status: ReferenceImageJobStatus
  storyId: string
  storyboardId: string | null
  createdAt: number
  startedAt?: number
  finishedAt?: number
  forceRegenerate: boolean
  results: Array<{
    name: string
    category: string
    ok: boolean
    skipped?: boolean
    id?: string
    url?: string
    thumbnailUrl?: string | null
    errorMessage?: string
  }>
  summary: { total: number; ok: number; skipped: number; failed: number }
  errorMessage?: string
}

export type ReferenceImageJobPayload = {
  jobId: string
  userId: string
  storyId: string
  storyboardId: string | null
  prompts: Array<{
    name: string
    prompt: string
    description?: string
    category: "background" | "role" | "item"
    generatedImageId?: string
  }>
  forceRegenerate: boolean
  traceId: string
}

export const REFERENCE_IMAGE_JOB_TYPE = "reference_image_generate"

export async function insertReferenceImageJob(payload: ReferenceImageJobPayload, snapshot: ReferenceImageJobSnapshot): Promise<void> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  await db.insert(jobs).values({
    id: payload.jobId,
    userId: payload.userId,
    type: REFERENCE_IMAGE_JOB_TYPE,
    status: "queued",
    storyId: payload.storyId,
    storyboardId: payload.storyboardId,
    payload: payload as unknown as Record<string, unknown>,
    snapshot: snapshot as unknown as Record<string, unknown>,
    progressVersion: 0,
    updatedAt: new Date()
  })
}

export async function getJobSnapshot(jobId: string): Promise<{ snapshot: ReferenceImageJobSnapshot; userId: string; progressVersion: number } | null> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  const rows = await db
    .select({ userId: jobs.userId, snapshot: jobs.snapshot, progressVersion: jobs.progressVersion })
    .from(jobs)
    .where(sql`${jobs.id} = ${jobId}`)
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    userId: row.userId,
    snapshot: row.snapshot as unknown as ReferenceImageJobSnapshot,
    progressVersion: row.progressVersion
  }
}

export async function getJobPayload(jobId: string): Promise<{ payload: ReferenceImageJobPayload; snapshot: ReferenceImageJobSnapshot } | null> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  const rows = await db
    .select({ payload: jobs.payload, snapshot: jobs.snapshot })
    .from(jobs)
    .where(sql`${jobs.id} = ${jobId}`)
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    payload: row.payload as unknown as ReferenceImageJobPayload,
    snapshot: row.snapshot as unknown as ReferenceImageJobSnapshot
  }
}

export async function tryClaimNextReferenceImageJob(): Promise<{ jobId: string; payload: ReferenceImageJobPayload; snapshot: ReferenceImageJobSnapshot } | null> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })

  const next = await db
    .select({ id: jobs.id, payload: jobs.payload, snapshot: jobs.snapshot })
    .from(jobs)
    .where(and(eq(jobs.type, REFERENCE_IMAGE_JOB_TYPE), eq(jobs.status, "queued")))
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
    payload: claimed.payload as unknown as ReferenceImageJobPayload,
    snapshot: claimed.snapshot as unknown as ReferenceImageJobSnapshot
  }
}

export async function persistJobSnapshot(jobId: string, snapshot: ReferenceImageJobSnapshot, patch?: { errorMessage?: string | null; finished?: boolean }): Promise<void> {
  await ensureJobsTable()
  const db = await getDb({ jobs, generatedImages, stories, storyOutlines, storyboards })
  await db
    .update(jobs)
    .set({
      status: snapshot.status,
      snapshot: snapshot as unknown as Record<string, unknown>,
      errorMessage: patch?.errorMessage ?? snapshot.errorMessage ?? null,
      finishedAt: patch?.finished ? new Date() : undefined,
      updatedAt: new Date(),
      progressVersion: sql`${jobs.progressVersion} + 1`
    })
    .where(sql`${jobs.id} = ${jobId}`)
}
