import type { VibeSessionState } from "../../../vibeCreatingState"
import { getVibeSeedreamModel } from "../../../vibeCreatingConfig"
import { persistTvcImageAsset } from "../../assets/persistAssets"
import { arkGenerateImage } from "../../../providers/ark/arkMedia"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"

export async function generateReferenceImagesBatch(params: {
  traceId: string
  storyId: string
  state: VibeSessionState
  requests: Array<{ ordinal: number; category: "role" | "background" | "item"; name: string; description: string; prompt: string }>
  size: string
  watermark: boolean
  overwriteExisting?: boolean
}): Promise<{
  nextState: VibeSessionState
  results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "reference_image"; url?: string }>
}> {
  const model = getVibeSeedreamModel("reference_image")

  await ensureTvcSchema()
  const db = await getDb({ tvcAssets })
  const storage = (() => {
    try {
      return getS3Storage()
    } catch {
      return null
    }
  })()

  const nextState = params.state
  const results: Array<{ ordinal: number; status: "生成成功" | "生成失败"; kind: "reference_image"; url?: string }> = []
  for (let i = 0; i < params.requests.length; i++) {
    const meta = params.requests[i]!
    const ordinal = Number.isFinite(Number(meta.ordinal)) ? Math.trunc(Number(meta.ordinal)) : 0
    let status: "生成成功" | "生成失败" = "生成失败"
    let resultUrl: string | undefined = undefined
    try {
      if (!params.overwriteExisting && ordinal > 0) {
        const [existing] = await db
          .select({ storageKey: tvcAssets.storageKey, meta: tvcAssets.meta })
          .from(tvcAssets)
          .where(and(eq(tvcAssets.storyId, params.storyId), eq(tvcAssets.kind, "reference_image"), eq(tvcAssets.assetOrdinal, ordinal)))
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
            results.push({ ordinal, status: "生成成功", kind: "reference_image", url })
            continue
          }
        }
      }

      const generated = await arkGenerateImage({ model, prompt: meta.prompt, size: params.size, watermark: params.watermark })
      const sourceUrl = generated.url
      if (!sourceUrl) {
        results.push({ ordinal, status, kind: "reference_image" })
        continue
      }
      const persisted = await persistTvcImageAsset({
        traceId: params.traceId,
        storyId: params.storyId,
        kind: "reference_image",
        assetOrdinal: ordinal,
        sourceUrl,
        meta: { category: meta.category, name: meta.name, description: meta.description, requestedOrdinal: ordinal },
        overwriteExisting: Boolean(params.overwriteExisting)
      })
      resultUrl = persisted.url
      status = "生成成功"
    } catch {
    }
    results.push({ ordinal, status, kind: "reference_image", ...(resultUrl ? { url: resultUrl } : {}) })
  }
  return { nextState, results }
}
