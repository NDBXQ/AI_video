import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { importVideoCreationScriptAsset } from "@/server/domains/video-creation/usecases/images/importScriptAsset"

const bodySchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  sourceGeneratedImageId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(50).default("reference")
})

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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { storyboardId, sourceGeneratedImageId, name, displayName, category } = parsed.data
  const res = await importVideoCreationScriptAsset({
    userId,
    storyboardId,
    sourceGeneratedImageId,
    name,
    ...(displayName ? { displayName } : {}),
    category
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { ...(res.data as any) }), { status: 200 })
}
