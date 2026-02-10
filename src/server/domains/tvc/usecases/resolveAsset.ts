import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { tvcAssets, tvcStories } from "@/shared/schema"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"

export async function resolveTvcProjectAsset(input: {
  userId: string
  storyId: string
  kind: "reference_image" | "first_frame" | "video_clip" | "user_image"
  index: number
}): Promise<
  | { ok: true; url: string; thumbnailUrl?: string }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION_FAILED"; message: string; status: 400 | 404 }
> {
  if (input.kind === "video_clip" && input.index <= 0) {
    return { ok: false, code: "VALIDATION_FAILED", message: "index 必须为正整数", status: 400 }
  }

  await ensureTvcSchema()

  const db = await getDb({ tvcStories, tvcAssets })
  const [row] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId, storyType: tvcStories.storyType })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, input.storyId), eq(tvcStories.userId, input.userId)))
    .limit(1)

  if (!row || row.storyType !== "tvc") return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }

  const candidateIndices = [input.index, input.index + 1, input.index - 1].filter((n) => Number.isFinite(n) && n > 0 && n <= 1_000_000)
  const uniqueCandidateIndices = Array.from(new Set(candidateIndices))

  let asset: { storageKey: string; thumbnailStorageKey: string | null; meta: Record<string, unknown> } | null = null
  for (const idx of uniqueCandidateIndices) {
    const [row] = await db
      .select({ storageKey: tvcAssets.storageKey, thumbnailStorageKey: tvcAssets.thumbnailStorageKey, meta: tvcAssets.meta })
      .from(tvcAssets)
      .where(and(eq(tvcAssets.storyId, input.storyId), eq(tvcAssets.kind, input.kind), eq(tvcAssets.assetOrdinal, idx)))
      .limit(1)
    if (row?.storageKey) {
      asset = row
      break
    }
  }

  if (!asset?.storageKey) return { ok: false, code: "NOT_FOUND", message: "资源不存在", status: 404 }

  let url = ""
  let thumbnailUrl = ""
  try {
    const storage = getS3Storage()
    url = await resolveStorageUrl(storage, asset.storageKey)
    thumbnailUrl = asset.thumbnailStorageKey ? await resolveStorageUrl(storage, asset.thumbnailStorageKey) : ""
  } catch {
    url = String((asset.meta as any)?.url ?? "").trim()
    thumbnailUrl = String((asset.meta as any)?.thumbnailUrl ?? "").trim()
    if (!url) {
      try {
        url = buildDirectBucketUrl(asset.storageKey)
      } catch {
      }
    }
    if (!thumbnailUrl && asset.thumbnailStorageKey) {
      try {
        thumbnailUrl = buildDirectBucketUrl(asset.thumbnailStorageKey)
      } catch {
      }
    }
  }

  return { ok: true, url, ...(thumbnailUrl ? { thumbnailUrl } : {}) }
}

