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

const querySchema = z.object({
  tvcStoryId: z.string().trim().min(1).max(200),
  kind: z.enum(["reference_image", "first_frame"]),
  ordinal: z.coerce.number().int().min(1).max(10_000),
  type: z.enum(["character", "background", "props"]).default("background")
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    tvcStoryId: url.searchParams.get("tvcStoryId") ?? "",
    kind: url.searchParams.get("kind") ?? "",
    ordinal: url.searchParams.get("ordinal") ?? "",
    type: url.searchParams.get("type") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  await ensureTvcSchema()
  const db = await getDb({ publicResources, tvcAssets, tvcStories })
  const [story] = await db.select({ id: tvcStories.id, userId: tvcStories.userId }).from(tvcStories).where(eq(tvcStories.id, parsed.data.tvcStoryId)).limit(1)
  if (!story || story.userId !== userId) return NextResponse.json(makeApiOk(traceId, { exists: false, id: null }), { status: 200 })

  const [asset] = await db
    .select({ storageKey: tvcAssets.storageKey })
    .from(tvcAssets)
    .where(and(eq(tvcAssets.storyId, parsed.data.tvcStoryId), eq(tvcAssets.kind, parsed.data.kind), eq(tvcAssets.assetOrdinal, parsed.data.ordinal)))
    .limit(1)
  if (!asset?.storageKey) return NextResponse.json(makeApiOk(traceId, { exists: false, id: null }), { status: 200 })

  const existed = await db
    .select({ id: publicResources.id })
    .from(publicResources)
    .where(and(eq(publicResources.userId, userId), eq(publicResources.originalStorageKey, asset.storageKey), eq(publicResources.type, parsed.data.type)))
    .limit(1)

  const id = existed[0]?.id ?? null
  return NextResponse.json(makeApiOk(traceId, { exists: Boolean(id), id }), { status: 200 })
}
