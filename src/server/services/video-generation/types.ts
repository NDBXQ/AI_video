export interface GenerateVideoInput {
  storyboardId?: string
  storyId?: string
  prompt: string
  mode: string
  ratio: string
  duration: number
  generateAudio?: boolean
  generate_audio?: boolean
  return_last_frame?: boolean
  watermark: boolean
  resolution?: string | null
  first_image: { url: string; file_type: string }
  last_image?: { url: string; file_type: string }
  forceRegenerate?: boolean
  async?: boolean
}

export interface GenerateVideoResult {
  jobId?: string
  status?: string
  storyId?: string | null
  storyboardId?: string | null
  video?: {
    url: string
    mode: string
  }
  lastFrameImage?: { url: string } | null
  async?: boolean
  // Allow for other properties from Coze direct response
  [key: string]: unknown
}
