import "server-only"

import { createVibeCreatingLangChainStream } from "./langchain/vibeCreatingLangChainStream"

export class VibeCreatingAgentService {
  static async createStream(params: {
    traceId: string
    userId: string
    prompt: string
    projectId: string | null
  }): Promise<ReadableStream<Uint8Array>> {
    return createVibeCreatingLangChainStream(params)
  }
}
