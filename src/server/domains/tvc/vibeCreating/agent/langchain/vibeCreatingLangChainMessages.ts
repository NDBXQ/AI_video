import "server-only"

import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages"
import type { TvcLlmMessage } from "../../llm/llmTypes"

export type ToolCallLike = { id?: string; name?: string; args?: unknown }

function toLangChainUserContent(content: unknown): unknown {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return String(content ?? "")
  const out: any[] = []
  for (const part of content as any[]) {
    const t = String(part?.type ?? "")
    if (t === "text") {
      const text = String(part?.text ?? "").trim()
      if (!text) continue
      out.push({ type: "text", source_type: "text", text })
      continue
    }
    if (t === "image_url") {
      const url = String(part?.image_url?.url ?? "").trim()
      if (!url) continue
      out.push({ type: "image", source_type: "url", url })
      continue
    }
  }
  return out.length ? out : ""
}

function normalizeArgs(args: unknown): Record<string, unknown> {
  if (!args) return {}
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args)
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { raw: args }
    } catch {
      return { raw: args }
    }
  }
  if (typeof args === "object") return args as Record<string, unknown>
  return { value: args }
}

export function toInternalToolCalls(raw: unknown): Array<{ id: string; name: string; args: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
  for (const c of raw as any[]) {
    const id = typeof c?.id === "string" && c.id.trim() ? c.id.trim() : ""
    const name = String(c?.name ?? c?.function?.name ?? "").trim()
    const args = normalizeArgs(c?.args ?? c?.function?.arguments ?? c?.arguments)
    if (!name) continue
    out.push({ id: id || crypto.randomUUID(), name, args })
  }
  return out
}

export function extractToolCalls(msg: AIMessage): ToolCallLike[] {
  const anyMsg = msg as any
  const toolCalls = Array.isArray(anyMsg?.tool_calls)
    ? anyMsg.tool_calls
    : Array.isArray(anyMsg?.additional_kwargs?.tool_calls)
      ? toInternalToolCalls(anyMsg.additional_kwargs.tool_calls)
      : []
  return (toolCalls as any[])
    .map((c: any) => ({ id: String(c?.id ?? ""), name: String(c?.name ?? ""), args: c?.args }))
    .filter((c: ToolCallLike) => Boolean(c.name))
}

export function normalizeToolArgs(args: unknown): Record<string, unknown> {
  return normalizeArgs(args)
}

export function convertTvcMessagesToLangChain(messages: TvcLlmMessage[]): BaseMessage[] {
  const out: BaseMessage[] = []
  for (const m of messages) {
    const role = String(m?.role ?? "")
    if (role === "system") {
      out.push(new SystemMessage(typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")))
      continue
    }
    if (role === "user") {
      const content = toLangChainUserContent(m.content)
      if (Array.isArray(content)) out.push(new HumanMessage({ content } as any))
      else out.push(new HumanMessage(content as any))
      continue
    }
    if (role === "assistant") {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
      const rawToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length ? m.tool_calls : undefined
      const internalToolCalls = rawToolCalls ? toInternalToolCalls(rawToolCalls) : undefined
      out.push(
        new AIMessage({
          content,
          ...(rawToolCalls
            ? ({ tool_calls: internalToolCalls, additional_kwargs: { tool_calls: rawToolCalls } } as any)
            : ({ tool_calls: [] } as any))
        }) as any
      )
      continue
    }
    if (role === "tool") {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")
      const toolCallId = typeof m.tool_call_id === "string" ? m.tool_call_id : ""
      out.push(new ToolMessage({ content, tool_call_id: toolCallId } as any))
      continue
    }
  }
  return out
}
