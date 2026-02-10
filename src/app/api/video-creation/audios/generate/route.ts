import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { generateVideoCreationAudio } from "@/server/domains/video-creation/usecases/audios/generateAudio"

export const runtime = "nodejs"

const inputSchema = z.object({
  storyboardId: z.string().trim().min(1).max(200),
  roleName: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(5000),
  speakerId: z.string().trim().min(1).max(200)
})

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)

  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  const res = await generateVideoCreationAudio({
    traceId,
    userId,
    storyboardId: parsed.data.storyboardId,
    roleName: parsed.data.roleName,
    text: parsed.data.text,
    speakerId: parsed.data.speakerId
  })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })
  return NextResponse.json(makeApiOk(traceId, { audioId: res.audioId, audioUrl: res.audioUrl, audioSize: res.audioSize }), { status: 200 })
}
