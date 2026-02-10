import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { inpaintAndOverwriteGeneratedImage } from "@/server/domains/video-creation/usecases/images/inpaint"

export const runtime = "nodejs"

const inputSchema = z.object({
  imageUrl: z.string().trim().min(1).max(4000),
  selection: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1)
  }),
  prompt: z.string().trim().min(1).max(5000),
  storyboardId: z.string().trim().min(1).max(200).nullable().optional(),
  generatedImageId: z.string().trim().min(1).max(200).nullable().optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const { imageUrl, selection, prompt, storyboardId, generatedImageId } = parsed.data
  const effectiveGeneratedImageId = typeof generatedImageId === "string" && generatedImageId.trim() ? generatedImageId.trim() : ""
  if (!effectiveGeneratedImageId) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 generatedImageId，无法覆盖原图"), { status: 400 })
  }
  const res = await inpaintAndOverwriteGeneratedImage({
    traceId,
    userId,
    imageUrl,
    selection,
    prompt,
    storyboardId,
    generatedImageId: effectiveGeneratedImageId
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { url: res.url, generatedImageId: res.generatedImageId }), { status: 200 })
}
