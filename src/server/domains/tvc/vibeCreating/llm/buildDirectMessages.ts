import type { StoryContext } from "../agent/vibeCreatingTypes"
import { parseChatContent } from "@/shared/tvcChatContent"
import { summarizeLlmMessage, auditDebug } from "@/shared/logAudit"
import type { TvcLlmContentPart, TvcLlmMessage } from "./llmTypes"

function normalizeText(v: string): string {
  return v.replace(/\r\n/g, "\n").trim()
}

function hasNonEmptyContent(content: TvcLlmMessage["content"]): boolean {
  if (typeof content === "string") return content.trim().length > 0
  if (!Array.isArray(content)) return false
  for (const part of content) {
    if (part?.type === "text" && typeof (part as any)?.text === "string" && (part as any).text.trim()) return true
    if (part?.type === "image_url" && typeof (part as any)?.image_url?.url === "string" && (part as any).image_url.url.trim()) {
      return true
    }
  }
  return false
}

function buildUserContent(raw: string): string | TvcLlmContentPart[] {
  const { text, attachments } = parseChatContent(String(raw ?? ""))
  const normalizedText = normalizeText(text)
  const images = attachments
    .filter((a) => a.kind === "image")
    .map((a) => String((a as any).url ?? "").trim())
    .filter((url) => /^https?:\/\//i.test(url))

  if (images.length === 0) return normalizedText

  const parts: TvcLlmContentPart[] = []
  if (normalizedText) parts.push({ type: "text", text: normalizedText })
  else parts.push({ type: "text", text: "用户上传了图片，请结合图片内容理解用户需求并回答。" })
  for (const url of images) parts.push({ type: "image_url", image_url: { url } })
  return parts
}

function pickRecentHistoryMessages(params: {
  story: StoryContext | null
  maxItems: number
}): {
  items: TvcLlmMessage[]
  source: "llm_messages" | "chat_messages" | "none"
  availableCount: number
  selectedCount: number
  truncated: boolean
} {
  const story = params.story
  if (!story) return { items: [], source: "none", availableCount: 0, selectedCount: 0, truncated: false }

  const llm = Array.isArray(story.recentLlmMessages) ? story.recentLlmMessages : null
  if (llm && llm.length) {
    const items = llm
      .filter((m) => ["user", "assistant", "tool"].includes(String(m?.role ?? "")))
      .map((m) => {
        const msg: TvcLlmMessage = { role: m.role as any }
        if (typeof m.content === "string") {
          msg.content = m.role === "user" ? buildUserContent(m.content) : m.content
        } else if (Array.isArray(m.content)) {
          msg.content = m.content
        }
        if (typeof m.tool_call_id === "string" && m.tool_call_id.trim()) msg.tool_call_id = m.tool_call_id.trim()
        if (typeof m.name === "string" && m.name.trim()) msg.name = m.name.trim()
        if (Array.isArray(m.tool_calls) && m.tool_calls.length) msg.tool_calls = m.tool_calls as any
        return msg
      })
      .filter((m) => {
        const contentOk = hasNonEmptyContent(m.content)
        const toolCallsOk = Array.isArray(m.tool_calls) && m.tool_calls.length > 0
        return contentOk || toolCallsOk
      })
    if (items.length <= params.maxItems) {
      return { items, source: "llm_messages", availableCount: llm.length, selectedCount: items.length, truncated: false }
    }
    return {
      items: items.slice(items.length - params.maxItems),
      source: "llm_messages",
      availableCount: llm.length,
      selectedCount: items.length,
      truncated: true
    }
  }

  if (!Array.isArray(story.recentMessages)) return { items: [], source: "none", availableCount: 0, selectedCount: 0, truncated: false }
  const items = story.recentMessages
    .map((m) => {
      const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user"
      const raw = normalizeText(String(m.content ?? ""))
      const content = role === "user" ? buildUserContent(raw) : raw
      return { role, content }
    })
    .filter((m) => hasNonEmptyContent(m.content as any))
  if (items.length <= params.maxItems) {
    return { items: items as any, source: "chat_messages", availableCount: story.recentMessages.length, selectedCount: items.length, truncated: false }
  }
  return {
    items: (items.slice(items.length - params.maxItems) as any) ?? [],
    source: "chat_messages",
    availableCount: story.recentMessages.length,
    selectedCount: items.length,
    truncated: true
  }
}

export function buildDirectMessages(params: {
  system: string
  story: StoryContext | null
  userPrompt: string
  maxHistoryMessages?: number
}): TvcLlmMessage[] {
  const maxHistory = typeof params.maxHistoryMessages === "number" ? Math.max(0, Math.trunc(params.maxHistoryMessages)) : 20
  const messages: TvcLlmMessage[] = [{ role: "system", content: params.system }]

  const history = pickRecentHistoryMessages({ story: params.story, maxItems: maxHistory })
  for (const m of history.items) messages.push(m)

  messages.push({ role: "user", content: buildUserContent(String(params.userPrompt ?? "")) })

  auditDebug("tvc_context", "tvc_build_direct_messages", "Direct messages 已构建", { traceId: "server" }, {
    historySource: history.source,
    historySelected: history.selectedCount,
    historyTruncated: history.truncated,
    sample: messages.slice(-5).map((m) => summarizeLlmMessage(m))
  })

  return messages
}
