import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { uploadTvcProjectProductImages } from "@/server/domains/tvc/usecases/uploadProductImages"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().trim().min(1).max(200)
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const rawParams = await ctx.params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const files: File[] = []
  const single = form.get("file")
  if (single instanceof File) files.push(single)
  for (const it of form.getAll("files")) if (it instanceof File) files.push(it)
  if (files.length === 0) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少文件"), { status: 400 })
  const res = await uploadTvcProjectProductImages({ userId, storyId: parsedParams.data.id, files })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })

  return NextResponse.json(makeApiOk(traceId, { items: res.items }), { status: 200 })
}
