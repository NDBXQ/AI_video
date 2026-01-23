import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, publicResources, stories } from "@/shared/schema"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

const querySchema = z.object({
  generatedImageId: z.string().trim().min(1).max(200)
})

function mapGeneratedCategoryToPublicType(category: string): "character" | "background" | "props" {
  if (category === "role") return "character"
  if (category === "item") return "props"
  return "background"
}

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ generatedImageId: url.searchParams.get("generatedImageId") ?? "" })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const db = await getDb({ generatedImages, publicResources, stories })
  const rows = await db
    .select({
      storageKey: generatedImages.storageKey,
      category: generatedImages.category
    })
    .from(generatedImages)
    .innerJoin(stories, eq(generatedImages.storyId, stories.id))
    .where(and(eq(generatedImages.id, parsed.data.generatedImageId), eq(stories.userId, userId)))
    .limit(1)

  const img = rows[0]
  if (!img) return NextResponse.json(makeApiOk(traceId, { exists: false, id: null }), { status: 200 })

  const type = mapGeneratedCategoryToPublicType(img.category)
  const existed = await db
    .select({ id: publicResources.id })
    .from(publicResources)
    .where(and(eq(publicResources.originalStorageKey, img.storageKey), eq(publicResources.type, type)))
    .limit(1)

  const id = existed[0]?.id ?? null
  return NextResponse.json(makeApiOk(traceId, { exists: Boolean(id), id }), { status: 200 })
}

