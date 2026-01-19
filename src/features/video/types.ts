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
  light: string
  color: string
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

export type StoryboardItem = {
  id: string
  scene_no: number
  shot_info: ShotInfo
  shot_content: ShotContent
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

