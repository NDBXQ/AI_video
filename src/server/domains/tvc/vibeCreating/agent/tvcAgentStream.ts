import { auditInfo } from "@/shared/logAudit"
import type { TvcAgentProvider, TvcAgentStreamParams } from "../../providers/types"
import { createVibeTvcAgentStream } from "../../providers/vibeProvider"

export async function createTvcAgentStream(params: TvcAgentStreamParams): Promise<{ stream: ReadableStream; provider: TvcAgentProvider }> {
  const provider: TvcAgentProvider = "vibe"
  auditInfo("tvc_context", "agent_stream_provider", "选择 agent provider", { traceId: params.traceId, storyId: params.storyId }, { provider, injectDbContext: true })
  const stream = await createVibeTvcAgentStream(params)
  return { stream, provider }
}
