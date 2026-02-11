import { ServiceError } from "@/server/shared/errors"
import type { VibeSessionState } from "../../../vibeCreatingState"
import { getVibeSeedreamModel } from "../../../vibeCreatingConfig"
import { persistTvcImageAsset } from "../../assets/persistAssets"
import { arkGenerateImage } from "../../../providers/ark/arkMedia"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, desc, eq, inArray } from "drizzle-orm"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"

export async function generateFirstFramesFromReferencesBatch(params: {
  traceId: string
  storyId: string
  state: VibeSessionState
  requests: Array<{ ordinal: number; description: string; prompt: string; referenceImageOrdinals: number[] }>
  size: string
  watermark: boolean
  overwriteExisting?: boolean
}): Promise<{
  nextState: VibeSessionState
  results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "first_frame"; url?: string }>
}> {
  const model = getVibeSeedreamModel("first_frame")

  await ensureTvcSchema()
  const db = await getDb({ tvcAssets })

  const storage = (() => {
    try {
      return getS3Storage()
    } catch {
      return null
    }
  })()

  const sanitizeImageName = (input: unknown): string => {
    const raw = String(input ?? "").trim()
    if (!raw) return ""
    const compact = raw.replace(/\s+/g, " ").replace(/\u0000/g, "").trim()
    const limited = compact.length > 50 ? compact.slice(0, 50) : compact
    return limited
  }

  const resolveReferenceImagesByOrdinals = async (
    ordinals: number[]
  ): Promise<Array<{ ordinal: number; url: string; displayName: string }>> => {
    const cleaned: number[] = Array.from(
      new Set(ordinals.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0))
    ).sort((a, b) => a - b)

    const resolveUrlFromRow = async (row: { storageKey: string; meta: unknown }): Promise<string> => {
      const storageKey = String(row.storageKey ?? "")
      let url = ""
      if (storage) {
        try {
          url = await resolveStorageUrl(storage, storageKey)
        } catch {
        }
      }
      if (!url) url = String((row.meta as any)?.url ?? "").trim()
      if (!url) {
        try {
          url = buildDirectBucketUrl(storageKey)
        } catch {
        }
      }
      return url
    }

    const resolveDisplayNameFromMeta = (meta: unknown, ordinal: number): string => {
      const title = sanitizeImageName((meta as any)?.title)
      if (title) return title
      const name = sanitizeImageName((meta as any)?.name)
      if (name) return name
      return `参考图${ordinal}`
    }

    if (cleaned.length === 0) {
      const rows = await db
        .select({ assetOrdinal: tvcAssets.assetOrdinal, storageKey: tvcAssets.storageKey, meta: tvcAssets.meta })
        .from(tvcAssets)
        .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "reference_image")))
        .orderBy(desc(tvcAssets.assetOrdinal))
        .limit(8)

      const out: Array<{ ordinal: number; url: string; displayName: string }> = []
      for (const r of rows) {
        const ordinal = Number.isFinite(Number(r.assetOrdinal)) ? Math.trunc(Number(r.assetOrdinal)) : 0
        if (!ordinal || ordinal <= 0) continue
        const url = await resolveUrlFromRow({ storageKey: r.storageKey, meta: r.meta })
        if (!url) continue
        out.push({ ordinal, url, displayName: resolveDisplayNameFromMeta(r.meta, ordinal) })
      }
      return out
    }

    const rows = await db
      .select({ assetOrdinal: tvcAssets.assetOrdinal, storageKey: tvcAssets.storageKey, meta: tvcAssets.meta })
      .from(tvcAssets)
      .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "reference_image"), inArray(tvcAssets.assetOrdinal, cleaned)))
      .limit(cleaned.length)

    const byOrdinal = new Map<number, { storageKey: string; meta: unknown }>()
    for (const r of rows) {
      const ordinal = Number.isFinite(Number(r.assetOrdinal)) ? Math.trunc(Number(r.assetOrdinal)) : 0
      if (!ordinal || ordinal <= 0) continue
      byOrdinal.set(ordinal, { storageKey: String(r.storageKey ?? ""), meta: r.meta })
    }

    const out: Array<{ ordinal: number; url: string; displayName: string }> = []
    for (const ordinal of cleaned) {
      const r = byOrdinal.get(ordinal)
      if (!r?.storageKey) continue
      const url = await resolveUrlFromRow({ storageKey: r.storageKey, meta: r.meta })
      if (!url) continue
      out.push({ ordinal, url, displayName: resolveDisplayNameFromMeta(r.meta, ordinal) })
    }
    return out
  }

  const nextState = params.state
  const results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "first_frame"; url?: string }> = []
  for (let i = 0; i < params.requests.length; i++) {
    const meta = params.requests[i]!
    let ordinal = Number.isFinite(Number(meta.ordinal)) ? Math.trunc(Number(meta.ordinal)) : 0
    let status: "生成成功" | "生成失败" = "生成失败"
    let resultUrl: string | undefined = undefined
    try {
      if (!ordinal) throw new ServiceError("TOOL_ARGS_INVALID", "requests[].ordinal 必须为正整数")
      if (!meta.referenceImageOrdinals || meta.referenceImageOrdinals.length === 0) {
        throw new ServiceError("TOOL_ARGS_INVALID", "requests[].reference_image_ordinals 不能为空")
      }
      if (!params.overwriteExisting && ordinal > 0) {
        const [existing] = await db
          .select({ storageKey: tvcAssets.storageKey, meta: tvcAssets.meta })
          .from(tvcAssets)
          .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "first_frame"), eq(tvcAssets.assetOrdinal, ordinal)))
          .limit(1)
        if (existing?.storageKey) {
          let url = ""
          if (storage) {
            try {
              url = await resolveStorageUrl(storage, existing.storageKey)
            } catch {
            }
          }
          if (!url) url = String((existing.meta as any)?.url ?? "").trim()
          if (!url) {
            try {
              url = buildDirectBucketUrl(existing.storageKey)
            } catch {
            }
          }
          if (url) {
            results.push({ ordinal, status: "生成成功", kind: "first_frame", url })
            continue
          }
        }
      }

      const refs = await resolveReferenceImagesByOrdinals(meta.referenceImageOrdinals)
      const mapping = refs.map((r) => `图${r.ordinal}是${r.displayName}`).join("，")
      const finalPrompt = mapping ? `${mapping}\n${String(meta.prompt ?? "")}` : String(meta.prompt ?? "")
      const urls = refs.map((r) => r.url)
      const generated = await arkGenerateImage({
        model,
        prompt: finalPrompt,
        image: urls.length === 0 ? undefined : urls.length === 1 ? urls[0] : urls,
        size: params.size,
        watermark: params.watermark
      })
      const sourceUrl = generated.url
      if (!sourceUrl) {
        results.push({ ordinal, status, kind: "first_frame" })
        continue
      }
      const persisted = await persistTvcImageAsset({
        traceId: params.traceId,
        storyId: params.storyId,
        kind: "first_frame",
        assetOrdinal: ordinal,
        sourceUrl,
        meta: { description: meta.description, referenceImages: meta.referenceImageOrdinals.map((n) => `ordinal=${n}`).join("; "), requestedOrdinal: ordinal },
        overwriteExisting: Boolean(params.overwriteExisting)
      })
      resultUrl = persisted.url
      status = "生成成功"
    } catch {
    }
    results.push({ ordinal, status, kind: "first_frame", ...(resultUrl ? { url: resultUrl } : {}) })
  }
  return { nextState, results }
}
