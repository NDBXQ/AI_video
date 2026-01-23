"use client"

import type { ReactElement } from "react"
import { CreateWorkspacePage } from "@/features/video/components/CreateWorkspacePage"

export function ImageCreatePage({
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
      initialTab="image"
      sceneNo={sceneNo}
      storyboardId={storyboardId}
      storyId={storyId}
      outlineId={outlineId}
    />
  )
}

