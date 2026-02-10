import { NextResponse } from "next/server"
import { z } from "zod"
import { makeApiErr } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { ServiceError } from "@/server/shared/errors"
import { VibeCreatingAgentService } from "@/server/domains/tvc/vibeCreating/agent/vibeCreatingAgentService"

export const runtime = "nodejs"

const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(50_000),
  projectId: z.string().trim().min(1).max(200).optional(),
  userId: z.string().trim().min(1).max(200).optional()
}).strict()

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ ok: false }, { status: 404 })
  const traceId = getTraceId(req.headers)
  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  }

  try {
    const stream = await VibeCreatingAgentService.createStream({
      traceId,
      userId: parsed.data.userId ?? "internal-test",
      prompt: parsed.data.prompt,
      projectId: parsed.data.projectId ?? "internal-test-session"
    })
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(makeApiErr(traceId, err.code, err.message), { status: 500 })
    }
    const anyErr = err as { message?: string }
    return NextResponse.json(makeApiErr(traceId, "INTERNAL_ERROR", anyErr.message ?? "内部错误"), { status: 500 })
  }
}
