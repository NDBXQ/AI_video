import type { TvcAgentBlock } from "@/features/tvc/agent/types"
import type { TvcChatAttachment } from "@/shared/tvcChatContent"

export type VibeStyleCard = {
  id: string
  title: string
  subtitle: string
  tags: string[]
}

export type TvcPhaseId = "clarification" | "script" | "reference_image" | "storyboard" | "first_frame" | "video_clip"

export type TvcPreviewTab = "shotlist" | "image" | "video"

export type ChatMessage = { id: string; role: "assistant" | "user"; text: string; blocks?: TvcAgentBlock[]; attachments?: TvcChatAttachment[] }
