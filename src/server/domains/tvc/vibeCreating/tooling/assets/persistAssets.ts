import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets } from "@/shared/schema/tvc"
import { uploadPublicBuffer } from "@/shared/storage"
import { getS3Storage } from "@/shared/storage"
import { resolveStorageUrl } from "@/shared/storageUrl"
import { getDb } from "coze-coding-dev-sdk"
import { generateThumbnailInside } from "@/server/lib/thumbnail"
import { fetchBinaryBuffer, fetchImageBuffer } from "./fetchAsset"
import { getImageFileExt, getVideoFileExt } from "./contentType"
import { and, eq } from "drizzle-orm"

export async function persistTvcImageAsset(params: {
  traceId: string
  storyId: string
  kind: "reference_image" | "first_frame"
  assetOrdinal: number
  sourceUrl: string
  meta: Record<string, unknown>
  overwriteExisting?: boolean
}): Promise<{ url: string; storageKey: string; thumbnailUrl: string; thumbnailStorageKey: string }> {
  await ensureTvcSchema()
  const db = await getDb({ tvcAssets })
  const existing = await (async () => {
    const [row] = await db
      .select({
        storageKey: tvcAssets.storageKey,
        thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
        meta: tvcAssets.meta
      })
      .from(tvcAssets)
      .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, params.kind), eq(tvcAssets.assetOrdinal, params.assetOrdinal)))
      .limit(1)
    if (!row?.storageKey) return null
    let url = ""
    let thumbnailUrl = ""
    try {
      const storage = getS3Storage()
      url = await resolveStorageUrl(storage, row.storageKey)
      thumbnailUrl = row.thumbnailStorageKey ? await resolveStorageUrl(storage, row.thumbnailStorageKey) : ""
    } catch {
      url = String((row.meta as any)?.url ?? "").trim()
      thumbnailUrl = String((row.meta as any)?.thumbnailUrl ?? "").trim()
    }
    url = url.trim()
    thumbnailUrl = thumbnailUrl.trim()
    if (!url) return null
    return {
      url,
      storageKey: String(row.storageKey),
      thumbnailUrl: thumbnailUrl || url,
      thumbnailStorageKey: String(row.thumbnailStorageKey ?? row.storageKey)
    }
  })()
  if (existing && !params.overwriteExisting) return existing

  const fetched = await fetchImageBuffer(params.sourceUrl)
  const fileExt = getImageFileExt(fetched.contentType)
  const thumb = await generateThumbnailInside(fetched.buffer, 640, params.traceId)
  const prefix = `tvc-assets/${params.storyId}/${params.kind}/${params.assetOrdinal}`
  const uploaded = await uploadPublicBuffer({ buffer: fetched.buffer, contentType: fetched.contentType, fileExt, prefix })
  const uploadedThumb = await uploadPublicBuffer({ buffer: thumb, contentType: "image/jpeg", fileExt: "jpg", prefix })

  const metaToStore: Record<string, unknown> = { ...(params.meta ?? {}), url: uploaded.url, thumbnailUrl: uploadedThumb.url }
  const insert = db.insert(tvcAssets).values({
    storyId: params.storyId,
    kind: params.kind,
    assetOrdinal: params.assetOrdinal,
    storageKey: uploaded.key,
    thumbnailStorageKey: uploadedThumb.key,
    mimeType: fetched.contentType,
    meta: metaToStore
  } as any)
  if (params.overwriteExisting) {
    await insert.onConflictDoUpdate({
      target: [tvcAssets.storyId, tvcAssets.kind, tvcAssets.assetOrdinal],
      set: {
        storageKey: uploaded.key,
        thumbnailStorageKey: uploadedThumb.key,
        mimeType: fetched.contentType,
        meta: metaToStore,
        updatedAt: new Date()
      } as any
    })
  } else {
    try {
      await insert
    } catch {
      const existing = await (async () => {
        const [row] = await db
          .select({
            storageKey: tvcAssets.storageKey,
            thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
            meta: tvcAssets.meta
          })
          .from(tvcAssets)
          .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, params.kind), eq(tvcAssets.assetOrdinal, params.assetOrdinal)))
          .limit(1)
        if (!row?.storageKey) return null
        let url = ""
        let thumbnailUrl = ""
        try {
          const storage = getS3Storage()
          url = await resolveStorageUrl(storage, row.storageKey)
          thumbnailUrl = row.thumbnailStorageKey ? await resolveStorageUrl(storage, row.thumbnailStorageKey) : ""
        } catch {
          url = String((row.meta as any)?.url ?? "").trim()
          thumbnailUrl = String((row.meta as any)?.thumbnailUrl ?? "").trim()
        }
        url = url.trim()
        thumbnailUrl = thumbnailUrl.trim()
        if (!url) return null
        return {
          url,
          storageKey: String(row.storageKey),
          thumbnailUrl: thumbnailUrl || url,
          thumbnailStorageKey: String(row.thumbnailStorageKey ?? row.storageKey)
        }
      })()
      if (existing) return existing
      throw new Error("persist_failed")
    }
  }

  const storage = getS3Storage()
  const url = await resolveStorageUrl(storage, uploaded.key)
  const thumbnailUrl = await resolveStorageUrl(storage, uploadedThumb.key)
  return { url, storageKey: uploaded.key, thumbnailUrl, thumbnailStorageKey: uploadedThumb.key }
}

export async function persistTvcVideoAsset(params: {
  traceId: string
  storyId: string
  assetOrdinal: number
  sourceUrl: string
  thumbnailSourceUrl?: string
  meta: Record<string, unknown>
  overwriteExisting?: boolean
}): Promise<{ url: string; storageKey: string; thumbnailUrl?: string; thumbnailStorageKey?: string }> {
  await ensureTvcSchema()
  const db = await getDb({ tvcAssets })
  const existing = await (async () => {
    const [row] = await db
      .select({
        storageKey: tvcAssets.storageKey,
        thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
        meta: tvcAssets.meta
      })
      .from(tvcAssets)
      .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "video_clip"), eq(tvcAssets.assetOrdinal, params.assetOrdinal)))
      .limit(1)
    if (!row?.storageKey) return null
    let url = ""
    let thumbnailUrl = ""
    try {
      const storage = getS3Storage()
      url = await resolveStorageUrl(storage, row.storageKey)
      thumbnailUrl = row.thumbnailStorageKey ? await resolveStorageUrl(storage, row.thumbnailStorageKey) : ""
    } catch {
      url = String((row.meta as any)?.url ?? "").trim()
      thumbnailUrl = String((row.meta as any)?.thumbnailUrl ?? "").trim()
    }
    url = url.trim()
    thumbnailUrl = thumbnailUrl.trim()
    if (!url) return null
    return {
      url,
      storageKey: String(row.storageKey),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(row.thumbnailStorageKey ? { thumbnailStorageKey: String(row.thumbnailStorageKey) } : {})
    }
  })()
  if (existing && !params.overwriteExisting) return existing

  const fetched = await fetchBinaryBuffer(params.sourceUrl)
  const fileExt = getVideoFileExt(fetched.contentType)
  const prefix = `tvc-assets/${params.storyId}/video_clip/${params.assetOrdinal}`
  const uploaded = await uploadPublicBuffer({ buffer: fetched.buffer, contentType: fetched.contentType, fileExt, prefix })

  let uploadedThumbKey: string | null = null
  let thumbnailUrl: string | null = null
  let thumbnailPublicUrl: string | null = null
  if (params.thumbnailSourceUrl) {
    const fetchedThumb = await fetchImageBuffer(params.thumbnailSourceUrl)
    const thumb = await generateThumbnailInside(fetchedThumb.buffer, 640, params.traceId)
    const uploadedThumb = await uploadPublicBuffer({ buffer: thumb, contentType: "image/jpeg", fileExt: "jpg", prefix })
    uploadedThumbKey = uploadedThumb.key
    thumbnailPublicUrl = uploadedThumb.url
    const storage = getS3Storage()
    thumbnailUrl = await resolveStorageUrl(storage, uploadedThumb.key)
  }

  const metaToStore: Record<string, unknown> = { ...(params.meta ?? {}), url: uploaded.url, ...(thumbnailPublicUrl ? { thumbnailUrl: thumbnailPublicUrl } : {}) }
  const insert = db.insert(tvcAssets).values({
    storyId: params.storyId,
    kind: "video_clip",
    assetOrdinal: params.assetOrdinal,
    storageKey: uploaded.key,
    thumbnailStorageKey: uploadedThumbKey,
    mimeType: fetched.contentType,
    meta: metaToStore
  } as any)
  if (params.overwriteExisting) {
    await insert.onConflictDoUpdate({
      target: [tvcAssets.storyId, tvcAssets.kind, tvcAssets.assetOrdinal],
      set: {
        storageKey: uploaded.key,
        thumbnailStorageKey: uploadedThumbKey,
        mimeType: fetched.contentType,
        meta: metaToStore,
        updatedAt: new Date()
      } as any
    })
  } else {
    try {
      await insert
    } catch {
      const existing = await (async () => {
        const [row] = await db
          .select({
            storageKey: tvcAssets.storageKey,
            thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
            meta: tvcAssets.meta
          })
          .from(tvcAssets)
          .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "video_clip"), eq(tvcAssets.assetOrdinal, params.assetOrdinal)))
          .limit(1)
        if (!row?.storageKey) return null
        let url = ""
        let thumbnailUrl = ""
        try {
          const storage = getS3Storage()
          url = await resolveStorageUrl(storage, row.storageKey)
          thumbnailUrl = row.thumbnailStorageKey ? await resolveStorageUrl(storage, row.thumbnailStorageKey) : ""
        } catch {
          url = String((row.meta as any)?.url ?? "").trim()
          thumbnailUrl = String((row.meta as any)?.thumbnailUrl ?? "").trim()
        }
        url = url.trim()
        thumbnailUrl = thumbnailUrl.trim()
        if (!url) return null
        return {
          url,
          storageKey: String(row.storageKey),
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          ...(row.thumbnailStorageKey ? { thumbnailStorageKey: String(row.thumbnailStorageKey) } : {})
        }
      })()
      if (existing) return existing
      throw new Error("persist_failed")
    }
  }

  const storage = getS3Storage()
  const url = await resolveStorageUrl(storage, uploaded.key)
  return {
    url,
    storageKey: uploaded.key,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(uploadedThumbKey ? { thumbnailStorageKey: uploadedThumbKey } : {})
  }
}
