import "server-only"

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import { getVibeCreatingToolSpecs } from "../../tools/vibeCreatingLlmTools"

export function createVibeCreatingLangChainTools(): DynamicStructuredTool[] {
  const specs = getVibeCreatingToolSpecs()
  return specs.map((s) => {
    const name = String(s.function?.name ?? "").trim()
    const description = String(s.function?.description ?? "").trim()
    return new DynamicStructuredTool({
      name,
      description,
      schema: z.object({}).passthrough(),
      func: async () =>
        JSON.stringify({
          error: "TOOL_ADAPTER_MISCONFIGURED",
          message: `tool(${name}) 尚未接入执行器`
        })
    })
  })
}
