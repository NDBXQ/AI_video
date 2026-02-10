"use client"

import type { ChatMessage } from "@/features/tvc/types"
import { parseAgentBlocks } from "@/features/tvc/agent/parseAgentBlocks"
import { parseChatContent } from "@/shared/tvcChatContent"

export function parseCreationChatMessages(messages: unknown[]): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return []
  return messages
    .map((m) => {
      const rec = m as any
      const role = rec?.role === "assistant" ? "assistant" : "user"
      const content = typeof rec?.content === "string" ? rec.content : ""
      if (!content.trim()) return null
      const parsed = parseChatContent(content)
      const blocks = role === "assistant" ? parseAgentBlocks(parsed.text).filter((b) => b.kind !== "text") : undefined
      return {
        id: String(rec?.id ?? `db_${Math.random().toString(16).slice(2)}`),
        role,
        text: parsed.text,
        blocks,
        ...(parsed.attachments.length ? { attachments: parsed.attachments } : {})
      } satisfies ChatMessage
    })
    .filter(Boolean) as ChatMessage[]
}

