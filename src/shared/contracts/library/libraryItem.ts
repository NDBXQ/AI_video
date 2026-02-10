import type { StoryMetadata } from "@/shared/contracts/video/story"

export type LibraryItem = {
  id: string
  title: string
  type: "draft" | "video" | "storyboard" | "material" | "tvc"
  updatedAt?: string
  subtitle?: string
  thumbnail?: string
  originalUrl?: string
  specs?: string
  scope?: "my" | "public" | "library" | "shared"
  publicCategory?: string
  metadata?: StoryMetadata
  progressStage?: string
}

