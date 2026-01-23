import { Suspense, type ReactElement } from "react"
import { VideoPageClient } from "./VideoPageClient"

type Tab = "list" | "board"

export default async function VideoPage({
  searchParams
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
}): Promise<ReactElement> {
  const resolvedSearchParams = await Promise.resolve(searchParams)
  const raw = resolvedSearchParams.tab
  const value = Array.isArray(raw) ? raw[0] : raw
  const initialTab: Tab = value === "board" ? "board" : "list"

  const storyIdRaw = resolvedSearchParams.storyId
  const storyId = Array.isArray(storyIdRaw) ? storyIdRaw[0] : storyIdRaw

  const outlineIdRaw = resolvedSearchParams.outlineId
  const outlineId = Array.isArray(outlineIdRaw) ? outlineIdRaw[0] : outlineIdRaw

  return (
    <Suspense fallback={null}>
      <VideoPageClient initialTab={initialTab} initialStoryId={storyId} initialOutlineId={outlineId} />
    </Suspense>
  )
}
