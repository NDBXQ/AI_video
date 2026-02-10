import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { publicResources } from "@/shared/schema"
import { ensurePublicSchema } from "@/server/db/ensurePublicSchema"

const bodySchema = z.object({
  id: z.string().trim().min(1).max(200),
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000)
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  await ensurePublicSchema()
  const db = await getDb({ publicResources })
  const res = await db
    .update(publicResources)
    .set({ durationMs: parsed.data.durationMs })
    .where(and(eq(publicResources.id, parsed.data.id), eq(publicResources.userId, userId)))

  const updated = Number((res as any)?.rowCount ?? 0)
  return NextResponse.json(makeApiOk(traceId, { ok: true, updated }), { status: 200 })
}

