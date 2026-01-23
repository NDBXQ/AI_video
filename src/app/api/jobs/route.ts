import { NextResponse, type NextRequest } from "next/server"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { kickAllWorkers } from "@/server/jobs/kickWorkers"
import { listJobsByStory } from "@/server/jobs/jobDb"

export async function GET(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  const { searchParams } = new URL(req.url)
  const storyId = searchParams.get("storyId") ?? ""
  if (!storyId) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "缺少 storyId"), { status: 400 })

  const activeOnly = searchParams.get("activeOnly") !== "false"
  const limitRaw = Number(searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20

  kickAllWorkers()
  const jobs = await listJobsByStory({ userId, storyId, activeOnly, limit })

  return NextResponse.json(makeApiOk(traceId, { jobs }), { status: 200 })
}

