import { getDb } from "coze-coding-dev-sdk"
import { eq } from "drizzle-orm"
import { tvcAssets, tvcChatMessages, tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"
import { auditDebug, toSnippet } from "@/shared/logAudit"

type PersistMessage = { role: "user" | "assistant"; content: string }

export async function getTvcProjectCreation(input: { userId: string; storyId: string }): Promise<{
  ok: boolean
  messages?: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: Date }>
  assets?: Array<{ kind: string; ordinal: number; url?: string; thumbnailUrl?: string; isUserProvided?: boolean; meta?: Record<string, unknown> }>
}> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories, tvcChatMessages, tvcAssets })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false }

  const rawMessages = await db
    .select({ id: tvcChatMessages.id, role: tvcChatMessages.role, content: tvcChatMessages.content, createdAt: tvcChatMessages.createdAt })
    .from(tvcChatMessages)
    .where(eq(tvcChatMessages.storyId, input.storyId))
    .orderBy(tvcChatMessages.createdAt)
  const messages = rawMessages
    .map((m) => {
      const role = m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : null
      if (!role) return null
      return { ...m, role }
    })
    .filter(Boolean) as Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: Date }>

  const assets = await db
    .select({
      kind: tvcAssets.kind,
      assetOrdinal: tvcAssets.assetOrdinal,
      storageKey: tvcAssets.storageKey,
      thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
      meta: tvcAssets.meta
    })
    .from(tvcAssets)
    .where(eq(tvcAssets.storyId, input.storyId))
    .orderBy(tvcAssets.kind, tvcAssets.assetOrdinal)

  const resolvedAssets = await (async () => {
    if (!assets.length) return []

    const canUseStorage = (() => {
      try {
        getS3Storage()
        return true
      } catch {
        return false
      }
    })()
    const storage = canUseStorage ? getS3Storage() : null

    const out: Array<{ kind: string; ordinal: number; url?: string; thumbnailUrl?: string; isUserProvided?: boolean; meta?: Record<string, unknown> }> = []
    for (const a of assets) {
      const kind = String(a.kind ?? "").trim()
      const meta = (a.meta ?? {}) as any
      const ordinal = Number.isFinite(Number(a.assetOrdinal)) ? Math.trunc(Number(a.assetOrdinal)) : 0

      if (kind === "clarification" || kind === "script") {
        const markdown = String(meta?.markdown ?? "").trim()
        if (!markdown) continue
        out.push({ kind, ordinal: 0, meta })
        continue
      }
      if (kind === "storyboards") {
        const xml = String(meta?.storyboardsXml ?? "").trim()
        const boards = Array.isArray(meta?.storyboards) ? (meta.storyboards as any[]) : []
        if (!xml && boards.length === 0) continue
        out.push({ kind, ordinal: 0, meta })
        continue
      }

      if (ordinal <= 0) continue
      let url = ""
      let thumbnailUrl = ""
      if (storage) {
        try {
          url = await resolveStorageUrl(storage, a.storageKey)
          thumbnailUrl = a.thumbnailStorageKey ? await resolveStorageUrl(storage, a.thumbnailStorageKey) : ""
        } catch {
        }
      }
      if (!url) url = String(meta?.url ?? "").trim()
      if (!thumbnailUrl) thumbnailUrl = String(meta?.thumbnailUrl ?? "").trim()
      if (!url) {
        try {
          url = buildDirectBucketUrl(a.storageKey)
        } catch {
        }
      }
      if (!thumbnailUrl && a.thumbnailStorageKey) {
        try {
          thumbnailUrl = buildDirectBucketUrl(a.thumbnailStorageKey)
        } catch {
        }
      }
      if (!url && !thumbnailUrl) continue
      const isUserProvided = kind === "user_image"
      out.push({ kind, ordinal, ...(url ? { url } : {}), ...(thumbnailUrl ? { thumbnailUrl } : {}), ...(isUserProvided ? { isUserProvided: true } : {}), meta })
    }
    return out
  })()

  return { ok: true, messages, assets: resolvedAssets }
}

export async function persistTvcProjectMessages(input: {
  traceId: string
  userId: string
  storyId: string
  messages: PersistMessage[]
}): Promise<{ ok: boolean }> {
  await ensureTvcSchema()

  const db = await getDb({ tvcStories, tvcChatMessages })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, input.storyId)).limit(1)
  if (!story || story.userId !== input.userId) return { ok: false }

  if (input.messages.length > 0) {
    auditDebug("tvc_creation", "creation_persist_messages_start", "准备写入 chat_messages", { traceId: input.traceId, storyId: input.storyId }, {
      messageCount: input.messages.length,
      roles: input.messages.reduce(
        (acc, m) => {
          acc[m.role] = (acc[m.role] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
      items: input.messages.map((m) => ({
        role: m.role,
        contentLen: m.content.length,
        contentSnippet: toSnippet(m.content, 240).text
      }))
    })
    await db.insert(tvcChatMessages).values(
      input.messages.map((m) => ({
        storyId: input.storyId,
        role: m.role,
        content: m.content
      }))
    )
  }

  auditDebug("tvc_creation", "creation_persist_done", "creation 写入完成", { traceId: input.traceId, storyId: input.storyId }, { messageCount: input.messages.length })

  return { ok: true }
}
