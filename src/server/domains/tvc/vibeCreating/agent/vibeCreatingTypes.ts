import type { TvcLlmMessage } from "../llm/llmTypes"

export type TvcAgentStreamData =
  | { type: "start" }
  | {
      type: "status"
      text: string
      stage?: string
      op?: string
      progress?: { current: number; total: number }
    }
  | { type: "delta"; text: string }
  | { type: "clarification"; phase: "delta" | "done"; markdown: string }
  | { type: "script"; phase: "delta" | "done"; markdown: string }
  | { type: "result"; raw: string; responseText?: string | null }
  | {
      type: "task"
      id: string
      kind: "reference_image" | "first_frame" | "video_clip"
      state: "queued" | "running" | "done" | "failed"
      targetOrdinal?: number
      targetOrdinals?: number[]
      producedCount?: number
      message?: string
    }
  | { type: "checkpoint"; name: string; detail?: Record<string, unknown> }
  | { type: "error"; code: string; message: string }

export type StoryContext = {
  storyId: string
  userId: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  recentLlmMessages?: TvcLlmMessage[]
  metadata: Record<string, unknown>
}
