"use client"

import type { ReactElement } from "react"
import { CreateWorkspacePage } from "@/features/video/components/CreateWorkspacePage"

export function VideoCreatePage({
  sceneNo,
  storyboardId,
  storyId,
  outlineId
}: {
  sceneNo: number
  storyboardId?: string
  storyId?: string
  outlineId?: string
}): ReactElement {
  return (
    <CreateWorkspacePage
      initialTab="video"
      sceneNo={sceneNo}
      storyboardId={storyboardId}
      storyId={storyId}
      outlineId={outlineId}
    />
  )
}

