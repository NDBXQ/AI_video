import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { makeApiErr } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { createTvcAgentResponseStream } from "@/server/domains/tvc/usecases"

export const runtime = "nodejs"

const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(50_000),
  projectId: z.string().trim().min(1).max(200)
}).strict()

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  }

  const res = await createTvcAgentResponseStream({ traceId, userId, storyId: parsed.data.projectId, prompt: parsed.data.prompt })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })

  return new NextResponse(res.stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  })
}
