import { getDb } from "coze-coding-dev-sdk"
import { and, asc, eq, gt, or, sql } from "drizzle-orm"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"

function parseCursor(raw: string | null | undefined): { ms: number; id: string } {
  const v = String(raw ?? "").trim()
  if (!v) return { ms: 0, id: "" }
  const [msRaw, idRaw] = v.split(":", 2)
  const ms = Number.parseInt(String(msRaw ?? "").trim(), 10)
  if (!Number.isFinite(ms) || ms <= 0) return { ms: 0, id: "" }
  return { ms, id: String(idRaw ?? "").trim() }
}

function formatCursor(updatedAt: Date, id: string): string {
  const ms = updatedAt instanceof Date ? updatedAt.getTime() : 0
  const safeMs = Number.isFinite(ms) && ms > 0 ? Math.trunc(ms) : 0
  return `${safeMs}:${String(id ?? "").trim()}`
}

export async function listTvcProjectAssets(input: {
  userId: string
  storyId: string
  cursor?: string | null
}): Promise<
  | { ok: true; items: Array<{ kind: string; ordinal: number; url: string; thumbnailUrl?: string; isUserProvided?: boolean; meta?: Record<string, unknown>; updatedAtMs: number; cursor: string }>; cursor: string }
  | { ok: false }
> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories, tvcAssets })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false }

  const { ms: cursorMs, id: cursorId } = parseCursor(input.cursor)
  const updatedAtMsExpr = sql<number>`cast(floor(extract(epoch from ${tvcAssets.updatedAt}) * 1000) as bigint)`

  const rows = await db
    .select({
      id: tvcAssets.id,
      kind: tvcAssets.kind,
      assetOrdinal: tvcAssets.assetOrdinal,
      storageKey: tvcAssets.storageKey,
      thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
      meta: tvcAssets.meta,
      updatedAt: tvcAssets.updatedAt
    })
    .from(tvcAssets)
    .where(
      cursorMs > 0
        ? and(eq(tvcAssets.storyId, input.storyId), or(gt(updatedAtMsExpr, cursorMs), and(eq(updatedAtMsExpr, cursorMs), gt(tvcAssets.id, cursorId))))
        : eq(tvcAssets.storyId, input.storyId)
    )
    .orderBy(asc(updatedAtMsExpr), asc(tvcAssets.id))
    .limit(200)

  if (rows.length === 0) {
    return { ok: true, items: [], cursor: cursorMs > 0 ? `${cursorMs}:${cursorId}` : "0:" }
  }

  const canUseStorage = (() => {
    try {
      getS3Storage()
      return true
    } catch {
      return false
    }
  })()
  const storage = canUseStorage ? getS3Storage() : null

  const items: Array<{
    kind: string
    ordinal: number
    url: string
    thumbnailUrl?: string
    isUserProvided?: boolean
    meta?: Record<string, unknown>
    updatedAtMs: number
    cursor: string
  }> = []

  for (const r of rows) {
    const ordinalRaw = Number(r.assetOrdinal)
    const ordinal = Number.isFinite(ordinalRaw) ? Math.trunc(ordinalRaw) : 0
    if (!ordinal || ordinal <= 0) continue

    const kind = String(r.kind ?? "").trim()
    const meta = (r.meta ?? {}) as any

    if (kind === "script") {
      const markdown = String(meta?.markdown ?? "").trim()
      if (!markdown) continue
      const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date()
      const cursor = formatCursor(updatedAt, String(r.id ?? ""))
      const updatedAtMs = updatedAt.getTime()
      items.push({
        kind,
        ordinal,
        url: "",
        meta,
        updatedAtMs: Number.isFinite(updatedAtMs) ? Math.trunc(updatedAtMs) : 0,
        cursor
      })
      continue
    }

    if (kind === "storyboards") {
      const xml = String(meta?.storyboardsXml ?? "").trim()
      const boards = Array.isArray(meta?.storyboards) ? (meta.storyboards as any[]) : []
      if (!xml && boards.length === 0) continue
      const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date()
      const cursor = formatCursor(updatedAt, String(r.id ?? ""))
      const updatedAtMs = updatedAt.getTime()
      items.push({
        kind,
        ordinal,
        url: "",
        meta,
        updatedAtMs: Number.isFinite(updatedAtMs) ? Math.trunc(updatedAtMs) : 0,
        cursor
      })
      continue
    }

    let resolvedUrl = ""
    let resolvedThumb = ""
    if (storage) {
      try {
        resolvedUrl = await resolveStorageUrl(storage, r.storageKey)
        resolvedThumb = r.thumbnailStorageKey ? await resolveStorageUrl(storage, r.thumbnailStorageKey) : ""
      } catch {
      }
    }
    if (!resolvedUrl) resolvedUrl = String((r.meta as any)?.url ?? "").trim()
    if (!resolvedThumb) resolvedThumb = String((r.meta as any)?.thumbnailUrl ?? "").trim()
    if (!resolvedUrl) {
      try {
        resolvedUrl = buildDirectBucketUrl(r.storageKey)
      } catch {
      }
    }
    if (!resolvedThumb && r.thumbnailStorageKey) {
      try {
        resolvedThumb = buildDirectBucketUrl(r.thumbnailStorageKey)
      } catch {
      }
    }
    if (!resolvedUrl && !resolvedThumb) continue

    const updatedAt = r.updatedAt instanceof Date ? r.updatedAt : new Date()
    const cursor = formatCursor(updatedAt, String(r.id ?? ""))
    const updatedAtMs = updatedAt.getTime()
    const isUserProvided = kind === "user_image"
    items.push({
      kind,
      ordinal,
      url: resolvedUrl,
      ...(resolvedThumb ? { thumbnailUrl: resolvedThumb } : {}),
      ...(isUserProvided ? { isUserProvided: true } : {}),
      meta,
      updatedAtMs: Number.isFinite(updatedAtMs) ? Math.trunc(updatedAtMs) : 0,
      cursor
    })
  }

  const last = rows[rows.length - 1]!
  const nextCursor = formatCursor(last.updatedAt instanceof Date ? last.updatedAt : new Date(), String(last.id ?? ""))
  return { ok: true, items, cursor: nextCursor }
}
