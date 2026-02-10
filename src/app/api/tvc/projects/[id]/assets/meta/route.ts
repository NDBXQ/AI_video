import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { updateTvcImageAssetMeta } from "@/server/domains/tvc/usecases/updateImageAssetMeta"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const bodySchema = z.object({
  kind: z.enum(["reference_image", "first_frame"]),
  ordinal: z.number().int().min(1).max(10_000),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).nullable().optional()
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const parsedParams = paramsSchema.safeParse(await ctx.params)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const res = await updateTvcImageAssetMeta({
    userId,
    storyId: parsedParams.data.id,
    kind: parsedBody.data.kind,
    ordinal: parsedBody.data.ordinal,
    title: parsedBody.data.title,
    description: typeof parsedBody.data.description === "string" ? parsedBody.data.description : null
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { ok: true }), { status: 200 })
}

