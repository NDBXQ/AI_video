import "server-only"

import { TextEncoder } from "node:util"
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { ServiceError } from "@/server/shared/errors"
import { createArkChatModel } from "./arkChatModel"
import { createDefaultAgentTools } from "./agentTools"
import { discoverAgentSkills } from "./agentSkills"

type ToolCallLike = {
  id?: string
  name?: string
  args?: unknown
}

function sseEvent(event: string, data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data)
  return `event: ${event}\ndata: ${payload}\n\n`
}

function getToolCalls(msg: AIMessage): ToolCallLike[] {
  const anyMsg = msg as any
  const toolCalls = anyMsg?.tool_calls ?? anyMsg?.additional_kwargs?.tool_calls ?? []
  if (!Array.isArray(toolCalls)) return []
  return toolCalls
    .map((c: any) => ({
      id: String(c?.id ?? ""),
      name: String(c?.name ?? c?.function?.name ?? ""),
      args: c?.args ?? c?.function?.arguments ?? c?.arguments
    }))
    .filter((c: ToolCallLike) => c.name)
}

function normalizeArgs(args: unknown): unknown {
  if (typeof args === "string") {
    try {
      return JSON.parse(args)
    } catch {
      return { raw: args }
    }
  }
  return args
}

export async function createLangChainAgentSseStream(params: {
  traceId: string
  prompt: string
  maxSteps?: number
}): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  const maxSteps = params.maxSteps ?? 8
  const prompt = params.prompt.trim()
  if (!prompt) throw new ServiceError("VALIDATION_FAILED", "prompt 不能为空")

  const tools = await createDefaultAgentTools()
  const skills = await discoverAgentSkills()

  const system = [
    "你是一个智能体助手。你可以在必要时调用工具来完成用户请求。",
    "如果需要加载某个技能，请先调用 list_skills 再决定是否 load_skill_instructions。",
    "当工具返回 JSON 字符串时，请解析并利用其中信息。",
    "",
    "可用 Skills：",
    ...skills.map((s) => `- ${s.name}: ${s.description || ""}`.trim())
  ]
    .filter(Boolean)
    .join("\n")

  const model = createArkChatModel({ traceId: params.traceId })
  const modelWithTools = (model as any).bindTools ? (model as any).bindTools(tools) : model

  return new ReadableStream<Uint8Array>({
    start: async (controller) => {
      controller.enqueue(encoder.encode(sseEvent("meta", { traceId: params.traceId })))

      const messages: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = [
        new SystemMessage(system),
        new HumanMessage(prompt)
      ]
      try {
        for (let step = 0; step < maxSteps; step++) {
          const ai = (await modelWithTools.invoke(messages)) as AIMessage
          const toolCalls = getToolCalls(ai)
          if (toolCalls.length === 0) {
            const text = Array.isArray(ai.content)
              ? ai.content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : String(ai.content ?? "")
            for (let i = 0; i < text.length; i += 64) {
              controller.enqueue(encoder.encode(sseEvent("token", text.slice(i, i + 64))))
            }
            controller.enqueue(encoder.encode(sseEvent("done", { ok: true })))
            controller.close()
            return
          }

          controller.enqueue(encoder.encode(sseEvent("tool_calls", toolCalls)))
          messages.push(ai)

          for (const call of toolCalls) {
            const toolName = call.name ?? ""
            const tool = tools.find((t) => t.name === toolName)
            if (!tool) {
              const err = { code: "TOOL_NOT_FOUND", message: `工具不存在：${toolName}` }
              controller.enqueue(encoder.encode(sseEvent("tool_result", { ...call, error: err })))
              messages.push(
                new ToolMessage({
                  content: JSON.stringify(err),
                  tool_call_id: call.id || toolName
                }) as any
              )
              continue
            }

            const input = normalizeArgs(call.args)
            const output = await tool.invoke(input as any)
            controller.enqueue(encoder.encode(sseEvent("tool_result", { ...call, output })))
            messages.push(
              new ToolMessage({
                content: typeof output === "string" ? output : JSON.stringify(output),
                tool_call_id: call.id || toolName
              }) as any
            )
          }
        }

        controller.enqueue(
          encoder.encode(sseEvent("error", { code: "MAX_STEPS_REACHED", message: "超过最大步数限制" }))
        )
        controller.close()
      } catch (err) {
        const anyErr = err as { code?: string; message?: string }
        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              code: anyErr.code || "INTERNAL_ERROR",
              message: anyErr.message || "内部错误"
            })
          )
        )
        controller.close()
      }
    }
  })
}

