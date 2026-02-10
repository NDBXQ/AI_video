export type StoryStatus = "draft" | "processing" | "ready" | "completed" | "failed" | "canceled"

export type StoryProgressStage =
  | "outline"
  | "storyboard_text"
  | "video_script"
  | "image_assets"
  | "video_assets"
  | "done"

export type StageState = "idle" | "processing" | "success" | "failed" | "canceled"

export type StageStatusDetail = {
  state: StageState
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  errorCode?: string
  errorMessage?: string
  [key: string]: unknown
}

export type StoryProgress = {
  outlineTotal?: number
  outlineStoryboardDone?: number
  shotTotal?: number
  shotScriptDone?: number
  shotVideoDone?: number
  [key: string]: number | undefined
}

export type StoryLastError = {
  stage: StoryProgressStage
  code?: string
  message: string
  at: string
  traceId?: string
}

export type StoryMetadata = {
  stageStatus?: Partial<Record<StoryProgressStage, StageStatusDetail>>
  progress?: StoryProgress
  lastError?: StoryLastError
  thumbnail?: string
  [key: string]: unknown
}

