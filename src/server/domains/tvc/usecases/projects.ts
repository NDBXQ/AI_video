import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq } from "drizzle-orm"
import { tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"

function mergeMetadata(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {}
  return { ...base, ...patch }
}

export async function createTvcProject(input: {
  userId: string
  title?: string
  brief?: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
}): Promise<{ ok: true; project: unknown }> {
  await ensureTvcSchema()

  const title = input.title?.trim() || "TVC 项目"
  const aspectRatio = input.aspectRatio?.trim() || "16:9"
  const resolution = input.resolution?.trim() || "1080p"
  const brief = input.brief?.trim() || ""
  const durationSec = input.durationSec ?? 30

  const db = await getDb({ tvcStories })
  const [row] = await db
    .insert(tvcStories)
    .values({
      userId: input.userId,
      title,
      storyType: "tvc",
      aspectRatio,
      resolution,
      storyText: brief || "TVC brief",
      metadata: { tvc: { brief, durationSec } } as any
    })
    .returning({
      id: tvcStories.id,
      title: tvcStories.title,
      storyType: tvcStories.storyType,
      aspectRatio: tvcStories.aspectRatio,
      resolution: tvcStories.resolution,
      shotStyle: tvcStories.shotStyle,
      storyText: tvcStories.storyText,
      metadata: tvcStories.metadata,
      createdAt: tvcStories.createdAt,
      updatedAt: tvcStories.updatedAt
    })

  return { ok: true, project: row }
}

export async function listTvcProjects(input: {
  userId: string
  limit: number
}): Promise<{ ok: true; projects: unknown[] }> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const rows = await db
    .select({
      id: tvcStories.id,
      title: tvcStories.title,
      storyType: tvcStories.storyType,
      aspectRatio: tvcStories.aspectRatio,
      resolution: tvcStories.resolution,
      shotStyle: tvcStories.shotStyle,
      storyText: tvcStories.storyText,
      metadata: tvcStories.metadata,
      createdAt: tvcStories.createdAt,
      updatedAt: tvcStories.updatedAt,
      progressStage: tvcStories.progressStage,
      status: tvcStories.status
    })
    .from(tvcStories)
    .where(and(eq(tvcStories.userId, input.userId), eq(tvcStories.storyType, "tvc")))
    .orderBy(desc(tvcStories.updatedAt), desc(tvcStories.createdAt))
    .limit(input.limit)

  return { ok: true, projects: rows }
}

export async function getTvcProject(input: {
  userId: string
  storyId: string
}): Promise<
  | { ok: true; project: unknown }
  | { ok: false; code: "NOT_FOUND"; message: string; status: 404 }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const rows = await db
    .select({
      id: tvcStories.id,
      title: tvcStories.title,
      storyType: tvcStories.storyType,
      aspectRatio: tvcStories.aspectRatio,
      resolution: tvcStories.resolution,
      shotStyle: tvcStories.shotStyle,
      storyText: tvcStories.storyText,
      metadata: tvcStories.metadata,
      createdAt: tvcStories.createdAt,
      updatedAt: tvcStories.updatedAt,
      progressStage: tvcStories.progressStage,
      status: tvcStories.status
    })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, input.storyId), eq(tvcStories.userId, input.userId)))
    .limit(1)

  const row = rows[0]
  if (!row || (row as any).storyType !== "tvc") return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }
  return { ok: true, project: row }
}

export async function patchTvcProject(input: {
  userId: string
  storyId: string
  patch: { title?: string; brief?: string; durationSec?: number; aspectRatio?: string; resolution?: string }
}): Promise<
  | { ok: true; project: unknown }
  | { ok: false; code: "NOT_FOUND"; message: string; status: 404 }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const [existing] = await db
    .select({
      id: tvcStories.id,
      userId: tvcStories.userId,
      storyType: tvcStories.storyType,
      metadata: tvcStories.metadata
    })
    .from(tvcStories)
    .where(eq(tvcStories.id, input.storyId))
    .limit(1)

  if (!existing || existing.userId !== input.userId || existing.storyType !== "tvc") {
    return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }
  }

  const title = input.patch.title?.trim()
  const aspectRatio = input.patch.aspectRatio?.trim()
  const resolution = input.patch.resolution?.trim()
  const brief = input.patch.brief?.trim()
  const durationSec = input.patch.durationSec

  const nextMetadata = mergeMetadata(existing.metadata, {
    tvc: mergeMetadata((existing.metadata as any)?.tvc, {
      ...(brief !== undefined ? { brief } : {}),
      ...(durationSec !== undefined ? { durationSec } : {}),
      ...(aspectRatio !== undefined ? { aspectRatio } : {}),
      ...(resolution !== undefined ? { resolution } : {})
    })
  })

  const [updated] = await db
    .update(tvcStories)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(aspectRatio !== undefined ? { aspectRatio } : {}),
      ...(resolution !== undefined ? { resolution } : {}),
      ...(brief !== undefined ? { storyText: brief || "TVC brief" } : {}),
      metadata: nextMetadata as any,
      updatedAt: new Date()
    })
    .where(and(eq(tvcStories.id, existing.id), eq(tvcStories.userId, input.userId)))
    .returning({
      id: tvcStories.id,
      title: tvcStories.title,
      storyType: tvcStories.storyType,
      aspectRatio: tvcStories.aspectRatio,
      resolution: tvcStories.resolution,
      shotStyle: tvcStories.shotStyle,
      storyText: tvcStories.storyText,
      metadata: tvcStories.metadata,
      createdAt: tvcStories.createdAt,
      updatedAt: tvcStories.updatedAt,
      progressStage: tvcStories.progressStage,
      status: tvcStories.status
    })

  return { ok: true, project: updated }
}

export async function deleteTvcProject(input: {
  userId: string
  storyId: string
}): Promise<
  | { ok: true; deletedId: string }
  | { ok: false; code: "NOT_FOUND"; message: string; status: 404 }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories })
  const [existing] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId, storyType: tvcStories.storyType })
    .from(tvcStories)
    .where(eq(tvcStories.id, input.storyId))
    .limit(1)

  if (!existing || existing.userId !== input.userId || existing.storyType !== "tvc") {
    return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }
  }

  await db.delete(tvcStories).where(and(eq(tvcStories.id, existing.id), eq(tvcStories.userId, input.userId)))
  return { ok: true, deletedId: existing.id }
}
