import { ServiceError } from "@/server/shared/errors"
import { createTvcAgentStream } from "@/server/domains/tvc/vibeCreating/agent/tvcAgentStream"

export async function createTvcAgentResponseStream(input: {
  traceId: string
  userId: string
  storyId: string
  prompt: string
}): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; code: string; message: string; status: number }
> {
  try {
    const { stream } = await createTvcAgentStream({
      traceId: input.traceId,
      userId: input.userId,
      prompt: input.prompt,
      storyId: input.storyId
    })
    return { ok: true, stream }
  } catch (err) {
    if (err instanceof ServiceError) {
      return { ok: false, code: err.code, message: err.message, status: 500 }
    }
    const anyErr = err as { message?: string }
    return { ok: false, code: "INTERNAL_ERROR", message: anyErr.message ?? "内部错误", status: 500 }
  }
}
