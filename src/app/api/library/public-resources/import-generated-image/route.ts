import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, publicResources, stories } from "@/shared/schema"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { getS3Storage } from "@/shared/storage"

const inputSchema = z.object({
  generatedImageId: z.string().trim().min(1).max(200)
})

function mapGeneratedCategoryToPublicType(category: string): "character" | "background" | "props" {
  if (category === "role") return "character"
  if (category === "item") return "props"
  return "background"
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  const db = await getDb({ generatedImages, publicResources, stories })

  const rows = await db
    .select({
      id: generatedImages.id,
      storyId: generatedImages.storyId,
      name: generatedImages.name,
      description: generatedImages.description,
      url: generatedImages.url,
      storageKey: generatedImages.storageKey,
      thumbnailUrl: generatedImages.thumbnailUrl,
      thumbnailStorageKey: generatedImages.thumbnailStorageKey,
      category: generatedImages.category
    })
    .from(generatedImages)
    .innerJoin(stories, eq(generatedImages.storyId, stories.id))
    .where(and(eq(generatedImages.id, parsed.data.generatedImageId), eq(stories.userId, userId)))
    .limit(1)

  const img = rows[0]
  if (!img) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "未找到图片或无权限"), { status: 404 })

  const type = mapGeneratedCategoryToPublicType(img.category)
  const previewKey = img.thumbnailStorageKey ?? img.storageKey
  const originalKey = img.storageKey

  const existed = await db
    .select({ id: publicResources.id })
    .from(publicResources)
    .where(and(eq(publicResources.originalStorageKey, originalKey), eq(publicResources.type, type)))
    .limit(1)
  if (existed.length > 0) {
    return NextResponse.json(makeApiOk(traceId, { ok: true, id: existed[0]!.id, skipped: true }), { status: 200 })
  }

  const storage = getS3Storage()
  const previewUrl = await storage.generatePresignedUrl({ key: previewKey, expireTime: 60 * 60 * 24 * 7 })
  const originalUrl = await storage.generatePresignedUrl({ key: originalKey, expireTime: 60 * 60 * 24 * 7 })

  const [created] = await db
    .insert(publicResources)
    .values({
      type,
      source: "ai",
      name: img.name,
      description: img.description ?? "",
      previewUrl,
      previewStorageKey: previewKey,
      originalUrl,
      originalStorageKey: originalKey,
      tags: [],
      applicableScenes: []
    })
    .returning({ id: publicResources.id })

  return NextResponse.json(makeApiOk(traceId, { ok: true, id: created?.id ?? null, skipped: false }), { status: 200 })
}
