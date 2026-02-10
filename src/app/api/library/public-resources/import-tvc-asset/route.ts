import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { publicResources } from "@/shared/schema/library"
import { tvcAssets, tvcStories } from "@/shared/schema/tvc"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { getS3Storage } from "@/shared/storage"
import { resolveStorageUrl } from "@/shared/storageUrl"

const bodySchema = z.object({
  tvcStoryId: z.string().trim().min(1).max(200),
  kind: z.enum(["reference_image", "first_frame"]),
  ordinal: z.number().int().min(1).max(10_000),
  type: z.enum(["character", "background", "props"]).default("background")
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  await ensureTvcSchema()
  const db = await getDb({ publicResources, tvcAssets, tvcStories })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, parsed.data.tvcStoryId)).limit(1)
  if (!story || story.userId !== userId) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "项目不存在或无权限"), { status: 404 })

  const [asset] = await db
    .select({
      storageKey: tvcAssets.storageKey,
      thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
      meta: tvcAssets.meta
    })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, parsed.data.tvcStoryId), eq(tvcAssets.kind, parsed.data.kind), eq(tvcAssets.assetOrdinal, parsed.data.ordinal)))
    .limit(1)

  if (!asset?.storageKey) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "未找到素材或素材不完整"), { status: 404 })

  const existed = await db
    .select({ id: publicResources.id })
    .from(publicResources)
    .where(and(eq(publicResources.userId, userId), eq(publicResources.originalStorageKey, asset.storageKey), eq(publicResources.type, parsed.data.type)))
    .limit(1)
  if (existed.length > 0) {
    return NextResponse.json(makeApiOk(traceId, { ok: true, id: existed[0]!.id, skipped: true }), { status: 200 })
  }

  const meta = (asset.meta ?? {}) as any
  const nameFromMeta = String(meta?.title ?? meta?.description ?? "").trim()
  const name = nameFromMeta || `${parsed.data.kind} #${parsed.data.ordinal}`
  const description = String(meta?.description ?? "").trim()

  const storage = getS3Storage()
  const previewKey = asset.thumbnailStorageKey ?? asset.storageKey
  const previewUrl = await resolveStorageUrl(storage, previewKey)
  const originalUrl = await resolveStorageUrl(storage, asset.storageKey)

  const [created] = await db
    .insert(publicResources)
    .values({
      userId,
      type: parsed.data.type,
      source: "ai",
      name,
      description,
      previewUrl,
      previewStorageKey: previewKey,
      originalUrl,
      originalStorageKey: asset.storageKey,
      tags: [],
      applicableScenes: []
    })
    .returning({ id: publicResources.id })

  return NextResponse.json(makeApiOk(traceId, { ok: true, id: created?.id ?? null, skipped: false }), { status: 200 })
}
