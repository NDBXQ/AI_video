import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, desc, eq, like, or, sql } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { publicResources } from "@/shared/schema"

const querySchema = z.object({
  type: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(0).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional()
})

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const limit = parsed.data.limit ?? 100
  const offset = parsed.data.offset ?? 0
  const keyword = (parsed.data.search ?? "").trim()
  const type = (parsed.data.type ?? "").trim()

  const whereParts: any[] = []
  if (type) whereParts.push(eq(publicResources.type, type))
  if (keyword) {
    const likeValue = `%${keyword}%`
    whereParts.push(or(like(publicResources.name, likeValue), like(publicResources.description, likeValue), sql`${publicResources.tags}::text LIKE ${likeValue}`))
  }
  const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined

  const db = await getDb({ publicResources })
  const items =
    limit <= 0
      ? []
      : await db
          .select()
          .from(publicResources)
          .where(whereClause as any)
          .orderBy(desc(publicResources.createdAt))
          .limit(limit)
          .offset(offset)

  return NextResponse.json(makeApiOk(traceId, { items }), { status: 200 })
}

