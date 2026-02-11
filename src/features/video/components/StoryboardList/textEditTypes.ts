export type StoryboardTextEditKind = "storyboardText" | "firstFramePrompt" | "lastFramePrompt" | "videoPrompt"

export type OpenStoryboardTextEditParams = {
  itemId: string
  kind: StoryboardTextEditKind
  initialValue: string
}

