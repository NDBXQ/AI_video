import { NextResponse } from "next/server"
import { z } from "zod"
import { makeApiErr } from "@/shared/api"
import { getTraceId } from "@/shared/trace"
import { ServiceError } from "@/server/shared/errors"
import { createLangChainAgentSseStream } from "@/server/agent/langchain/runLangChainAgentStream"

export const runtime = "nodejs"

const inputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(50_000),
    maxSteps: z.number().int().min(1).max(30).optional()
  })
  .strict()

export async function POST(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })
  }

  try {
    const stream = await createLangChainAgentSseStream({
      traceId,
      prompt: parsed.data.prompt,
      maxSteps: parsed.data.maxSteps
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

