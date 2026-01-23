"use server"

import { cookies } from "next/headers"
import { getDb } from "coze-coding-dev-sdk"
import { publicResources } from "@/shared/schema"
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm"
import { logger } from "@/shared/logger"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

type PublicResourceType = "all" | "character" | "background" | "props"
const ENABLED_PUBLIC_RESOURCE_TYPES = ["character", "background", "props"] as const

export async function listPublicResources(params: {
  type?: PublicResourceType
  search?: string
  sort?: "recent" | "oldest" | "title"
  limit?: number
  offset?: number
}) {
  const db = await getDb({ publicResources })
  const limit = typeof params.limit === "number" ? Math.max(0, Math.min(100, params.limit)) : 60
  const offset = typeof params.offset === "number" ? Math.max(0, params.offset) : 0
  const type = params.type ?? "all"
  const keyword = (params.search ?? "").trim()

  const whereParts: (ReturnType<typeof eq> | ReturnType<typeof or>)[] = []
  whereParts.push(inArray(publicResources.type, ENABLED_PUBLIC_RESOURCE_TYPES as unknown as string[]))
  if (type !== "all") whereParts.push(eq(publicResources.type, type))

  if (keyword.length > 0) {
    const likeValue = `%${keyword}%`
    whereParts.push(
      or(
        like(publicResources.name, likeValue),
        like(publicResources.description, likeValue),
        sql`${publicResources.tags}::text LIKE ${likeValue}`
      )
    )
  }

  const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined

  const countRows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(publicResources)
    .where(whereClause as any)
  const total = Number(countRows?.[0]?.count || 0)

  const sort = params.sort ?? "recent"
  const items =
    limit <= 0
      ? []
      : await db
          .select()
          .from(publicResources)
          .where(whereClause as any)
          .orderBy(
            sort === "title"
              ? asc(publicResources.name)
              : sort === "oldest"
                ? asc(publicResources.createdAt)
                : desc(publicResources.createdAt)
          )
          .limit(limit)
          .offset(offset)

  return { items, total }
}

export async function getPublicResourceStats() {
  const db = await getDb({ publicResources })
  const rows = await db
    .select({ type: publicResources.type, count: sql<number>`count(*)`.mapWith(Number) })
    .from(publicResources)
    .where(inArray(publicResources.type, ENABLED_PUBLIC_RESOURCE_TYPES as unknown as string[]))
    .groupBy(publicResources.type)

  const base = {
    all: 0,
    character: 0,
    background: 0,
    props: 0
  }

  for (const row of rows) {
    const type = row.type as keyof typeof base
    if (type in base) {
      base[type] = row.count
      base.all += row.count
    }
  }

  return base
}

export async function deletePublicResources(ids: string[]) {
  const traceId = getTraceId(new Headers())
  const start = Date.now()

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return { deletedCount: 0 }

  const session = await verifySessionToken(token, traceId)
  if (!session) return { deletedCount: 0 }

  const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 200)
  if (uniqueIds.length <= 0) return { deletedCount: 0 }

  logger.info({
    event: "library_public_resources_delete_start",
    module: "library",
    traceId,
    message: "开始删除公共资源",
    count: uniqueIds.length
  })

  const db = await getDb({ publicResources })
  const result = await db.delete(publicResources).where(inArray(publicResources.id, uniqueIds))

  logger.info({
    event: "library_public_resources_delete_success",
    module: "library",
    traceId,
    message: "删除公共资源成功",
    durationMs: Date.now() - start,
    deletedCount: result.rowCount ?? 0
  })

  return { deletedCount: result.rowCount ?? 0 }
}
