import { VibeCreatingAgentService } from "../vibeCreating/agent/vibeCreatingAgentService"
import type { TvcAgentStreamParams } from "./types"

export async function createVibeTvcAgentStream(params: TvcAgentStreamParams): Promise<ReadableStream> {
  return VibeCreatingAgentService.createStream({
    traceId: params.traceId,
    userId: params.userId,
    prompt: params.prompt,
    projectId: params.storyId
  })
}
