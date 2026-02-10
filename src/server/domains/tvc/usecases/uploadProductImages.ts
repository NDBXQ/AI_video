import { getDb } from "coze-coding-dev-sdk"
import { and, eq, sql } from "drizzle-orm"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { uploadPublicBuffer } from "@/shared/storage"
import { getImageFileExt } from "@/server/domains/tvc/vibeCreating/tooling/contentType"

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export async function uploadTvcProjectProductImages(input: {
  userId: string
  storyId: string
  files: File[]
}): Promise<
  | { ok: true; items: Array<{ url: string; key: string; assetId: string }> }
  | { ok: false; code: string; message: string; status: number }
> {
  if (input.files.length === 0) return { ok: false, code: "VALIDATION_FAILED", message: "缺少文件", status: 400 }

  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcAssets })
  const [row] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId, storyType: tvcStories.storyType })
    .from(tvcStories)
    .where(and(eq(tvcStories.id, input.storyId), eq(tvcStories.userId, input.userId)))
    .limit(1)

  if (!row || row.storyType !== "tvc") return { ok: false, code: "NOT_FOUND", message: "项目不存在", status: 404 }

  const [{ maxIndex }] = await db
    .select({ maxIndex: sql<number | null>`max(${tvcAssets.assetOrdinal})` })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, input.storyId), eq(tvcAssets.kind, "user_image")))
    .limit(1)
  let nextIndex = Math.max(1, Math.trunc(Number(maxIndex ?? 0) + 1))

  const uploadedItems: Array<{ url: string; key: string; assetId: string }> = []
  for (const file of input.files) {
    const contentType = (file.type || "application/octet-stream").trim()
    if (!contentType.toLowerCase().startsWith("image/")) {
      return { ok: false, code: "VALIDATION_FAILED", message: "仅支持图片文件", status: 400 }
    }
    if (Number(file.size ?? 0) > MAX_UPLOAD_BYTES) {
      return { ok: false, code: "PAYLOAD_TOO_LARGE", message: "单张图片最大支持 5MB", status: 413 }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return { ok: false, code: "PAYLOAD_TOO_LARGE", message: "单张图片最大支持 5MB", status: 413 }
    }
    const prefix = `tvc-assets/${input.storyId}/user_product`
    const uploaded = await uploadPublicBuffer({ buffer, contentType, fileExt: getImageFileExt(contentType), prefix })

    const assetIndex = nextIndex
    nextIndex += 1
    const metaToStore: Record<string, unknown> = { category: "产品", description: "产品图", url: uploaded.url }
    const [inserted] = await db
      .insert(tvcAssets)
      .values({
        storyId: input.storyId,
        kind: "user_image",
        assetOrdinal: assetIndex,
        storageKey: uploaded.key,
        thumbnailStorageKey: null,
        mimeType: contentType,
        meta: metaToStore
      } as any)
      .returning({ id: tvcAssets.id })

    const assetId = String(inserted?.id ?? "").trim()
    const url = uploaded.url.trim()
    if (assetId && url) uploadedItems.push({ url, key: uploaded.key, assetId })
  }

  return { ok: true, items: uploadedItems }
}
