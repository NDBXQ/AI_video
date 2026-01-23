import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { ImageGenerationService } from "@/server/services/imageGenerationService"

const promptSchema = z.object({
  name: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(80_000),
  description: z.string().trim().max(10_000).optional(),
  category: z.enum(["background", "role", "item"]).default("background"),
  generatedImageId: z.string().trim().min(1).max(200).optional()
})

const inputSchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  prompts: z.array(promptSchema).min(1).max(50),
  forceRegenerate: z.boolean().default(false),
  async: z.boolean().default(false)
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

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "入参格式不正确"), { status: 400 })

  try {
    const result = await ImageGenerationService.generateImages(userId, parsed.data, traceId)
    
    if (result.async) {
      return NextResponse.json(makeApiOk(traceId, { jobId: result.jobId, status: result.status }), { status: 202 })
    }

    return NextResponse.json(makeApiOk(traceId, result), { status: 200 })
  } catch (err) {
    const anyErr = err as { message?: string }
    if (anyErr.message === "STORY_NOT_FOUND") {
      return NextResponse.json(makeApiErr(traceId, "STORY_NOT_FOUND", "未找到可用的故事"), { status: 404 })
    }
    return NextResponse.json(makeApiErr(traceId, "IMAGE_GENERATION_FAILED", anyErr.message ?? "生成失败"), { status: 500 })
  }
}
