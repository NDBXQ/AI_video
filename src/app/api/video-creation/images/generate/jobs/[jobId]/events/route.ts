import { NextResponse, type NextRequest } from "next/server"
import { getSessionFromRequest } from "@/shared/session"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { createReferenceImageJobEventsStream } from "@/server/domains/video-creation/usecases/images/referenceImageJob"

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const { jobId } = await params
  const res = await createReferenceImageJobEventsStream({ traceId, userId, jobId, signal: req.signal })
  if (!res.ok) return NextResponse.json(makeApiErr(traceId, res.code, res.message), { status: res.status })

  return new NextResponse(res.stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  })
}
