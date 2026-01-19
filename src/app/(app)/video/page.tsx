import { Suspense, type ReactElement } from "react"
import { VideoPageClient } from "./VideoPageClient"

type Tab = "list" | "board"

export default function VideoPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>
}): ReactElement {
  const raw = searchParams.tab
  const value = Array.isArray(raw) ? raw[0] : raw
  const initialTab: Tab = value === "board" ? "board" : "list"

  return (
    <Suspense fallback={null}>
      <VideoPageClient initialTab={initialTab} />
    </Suspense>
  )
}
