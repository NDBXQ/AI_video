export type TvcLlmRole = "system" | "user" | "assistant" | "tool"

export type TvcLlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type TvcToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type TvcToolSpec = {
  type: "function"
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export type TvcLlmMessage = {
  role: TvcLlmRole
  content?: string | TvcLlmContentPart[]
  tool_call_id?: string
  name?: string
  tool_calls?: TvcToolCall[]
}

