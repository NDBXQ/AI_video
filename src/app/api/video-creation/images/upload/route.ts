import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { uploadVideoCreationImage } from "@/server/domains/video-creation/usecases/images/uploadImage"

const formSchema = z.object({
  storyId: z.string().trim().min(1).max(200).optional(),
  storyboardId: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(50).default("reference"),
  description: z.string().trim().max(10_000).optional()
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json(makeApiErr(traceId, "INVALID_FORM", "上传表单解析失败"), { status: 400 })

  const file = formData.get("file")
  const parsed = formSchema.safeParse({
    storyId: formData.get("storyId") ?? undefined,
    storyboardId: formData.get("storyboardId") ?? undefined,
    name: formData.get("name") ?? "",
    displayName: formData.get("displayName") ?? undefined,
    category: formData.get("category") ?? undefined,
    description: formData.get("description") ?? undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  if (!(file instanceof File)) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少上传文件"), { status: 400 })

  const { storyId: rawStoryId, storyboardId, name, displayName, category, description } = parsed.data
  const res = await uploadVideoCreationImage({
    traceId,
    userId,
    ...(rawStoryId ? { storyId: rawStoryId } : {}),
    ...(storyboardId ? { storyboardId } : {}),
    name,
    ...(displayName ? { displayName } : {}),
    category,
    ...(description ? { description } : {}),
    file
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { ...(res.data as any) }), { status: 200 })
}
