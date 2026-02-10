export const VIBE_SKILLS = [
  "tvc-orchestrator",
  "tvc-script",
  "tvc-reference-images",
  "tvc-storyboard",
  "tvc-first-frame",
  "tvc-video-generation",
  "tvc-background-music"
] as const

export type VibeSkillName = (typeof VIBE_SKILLS)[number]
