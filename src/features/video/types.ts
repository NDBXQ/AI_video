import type { StoryboardScriptContent } from "@/shared/schema"

export type RoleSpeak = {
  time_point: number
  tone: string
  content: string
  speed: number
  emotion: string
}

export type Role = {
  role_name: string
  appearance_time_point: number
  location_info: string
  action: string
  expression: string
  speak: RoleSpeak | null
  avatar_url?: string
}

export type Background = {
  background_name: string
  status: string
}

export type Shoot = {
  shot_angle: string
  angle: string
  camera_movement: string
  composition: string
}

export type ShotContent = {
  background: Background
  roles: Role[]
  role_items: string[]
  other_items: string[]
  shoot: Shoot
  bgm: string
}

export type ShotInfo = {
  shot_duration: number
  cut_to: boolean
  shot_style: string
}

export type StoryboardFrameAsset = {
  url?: string | null
  thumbnailUrl?: string | null
  prompt?: string | null
}

export type StoryboardFrames = {
  first?: StoryboardFrameAsset
  last?: StoryboardFrameAsset
}

export type StoryboardVideoSettings = {
  mode?: string | null
  generateAudio?: boolean | null
  watermark?: boolean | null
}

export type StoryboardVideoInfo = {
  url?: string | null
  prompt?: string | null
  storageKey?: string | null
  durationSeconds?: number | null
  settings?: StoryboardVideoSettings
}

export type StoryboardItem = {
  id: string
  scene_no: number
  storyboard_text?: string
  shot_info: ShotInfo
  shot_content: ShotContent
  scriptContent?: StoryboardScriptContent | null
  frames: StoryboardFrames
  videoInfo: StoryboardVideoInfo
  note?: string
}

export type Episode = {
  id: string
  name: string
  status: "completed" | "processing" | "pending"
}

export type StoryboardData = {
  items: StoryboardItem[]
}

export type ApiEpisode = Episode & { sequence?: number }
export type ApiOutline = { id: string; sequence: number; outlineText: string; originalText: string }
export type ApiShot = {
  id: string
  sequence: number
  storyboardText: string
  shotCut: boolean
  scriptContent: StoryboardScriptContent | null
  frames: StoryboardFrames
  videoInfo: StoryboardVideoInfo
}

export type VideoStoryboardsResponse = {
  storyId: string
  activeOutlineId: string | null
  episodes: ApiEpisode[]
  outlines: ApiOutline[]
  shots: ApiShot[]
}
