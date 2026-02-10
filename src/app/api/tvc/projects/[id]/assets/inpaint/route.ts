import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { inpaintTvcImageAsset } from "@/server/domains/tvc/usecases/inpaintImageAsset"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

const bodySchema = z.object({
  kind: z.enum(["reference_image", "first_frame"]),
  ordinal: z.number().int().min(1).max(10_000),
  imageUrl: z.string().trim().min(1).max(4000),
  selection: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1)
  }),
  prompt: z.string().trim().min(1).max(5000)
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const parsedParams = paramsSchema.safeParse(await ctx.params)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const body = await req.json().catch(() => null)
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const res = await inpaintTvcImageAsset({
    traceId,
    userId,
    storyId: parsedParams.data.id,
    kind: parsedBody.data.kind,
    ordinal: parsedBody.data.ordinal,
    imageUrl: parsedBody.data.imageUrl,
    selection: parsedBody.data.selection,
    prompt: parsedBody.data.prompt
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { url: res.url, thumbnailUrl: res.thumbnailUrl }), { status: 200 })
}

