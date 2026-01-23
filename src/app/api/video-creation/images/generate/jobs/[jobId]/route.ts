import { NextResponse, type NextRequest } from "next/server"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { getJobSnapshot } from "@/server/jobs/referenceImageDbQueue"
import { kickReferenceImageWorker } from "@/server/jobs/referenceImageWorker"

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const { jobId } = await params
  kickReferenceImageWorker()
  const row = await getJobSnapshot(jobId)
  if (!row) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "任务不存在或已过期"), { status: 404 })
  if (row.userId !== userId) return NextResponse.json(makeApiErr(traceId, "FORBIDDEN", "无权限访问该任务"), { status: 403 })

  return NextResponse.json(makeApiOk(traceId, row.snapshot), { status: 200 })
}
