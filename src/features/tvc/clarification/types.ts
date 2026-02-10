export type ClarificationEvent = { phase: "delta" | "done"; markdown: string }

export type ClarificationUiState = { text: string; done: boolean } | null

