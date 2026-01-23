import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { generatedImages, publicResources, stories } from "@/shared/schema"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { logger } from "@/shared/logger"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const raw = await params
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const db = await getDb({ publicResources, generatedImages, stories })
  const existed = await db
    .select({ id: publicResources.id, originalStorageKey: publicResources.originalStorageKey })
    .from(publicResources)
    .where(eq(publicResources.id, parsed.data.id))
    .limit(1)

  const resource = existed[0]
  if (!resource) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "资源不存在"), { status: 404 })
  if (!resource.originalStorageKey) return NextResponse.json(makeApiErr(traceId, "FORBIDDEN", "无权限删除该资源"), { status: 403 })

  const owned = await db
    .select({ id: generatedImages.id })
    .from(generatedImages)
    .innerJoin(stories, eq(generatedImages.storyId, stories.id))
    .where(and(eq(generatedImages.storageKey, resource.originalStorageKey), eq(stories.userId, userId)))
    .limit(1)

  if (owned.length === 0) return NextResponse.json(makeApiErr(traceId, "FORBIDDEN", "无权限删除该资源"), { status: 403 })

  logger.info({
    event: "library_public_resource_delete_start",
    module: "library",
    traceId,
    message: "开始删除公共素材",
    publicResourceId: parsed.data.id
  })

  await db.delete(publicResources).where(eq(publicResources.id, parsed.data.id))

  logger.info({
    event: "library_public_resource_delete_success",
    module: "library",
    traceId,
    message: "删除公共素材成功",
    publicResourceId: parsed.data.id
  })

  return NextResponse.json(makeApiOk(traceId, { deleted: true }), { status: 200 })
}

