import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { getSessionFromRequest } from "@/shared/session"
import { createSampleStory } from "@/server/domains/onboarding/usecases/createSampleStory"

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) {
    return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })
  }

  const { storyId } = await createSampleStory({ userId })
  return NextResponse.json(makeApiOk(traceId, { storyId }), { status: 200 })
}
