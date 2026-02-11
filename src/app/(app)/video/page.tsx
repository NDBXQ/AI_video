import { Suspense, type ReactElement } from "react"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { VideoPageClient } from "./VideoPageClient"
import { stories } from "@/shared/schema"

type Tab = "list" | "board"

export const dynamic = "force-dynamic"

function isShortDramaReady(metadata: Record<string, unknown>): boolean {
  const shortDrama = (metadata as any)?.shortDrama
  if (!shortDrama || typeof shortDrama !== "object") return false
  if (typeof (shortDrama as any).planningConfirmedAt !== "number") return false
  if (!(shortDrama as any).planningResult) return false
  if (!(shortDrama as any).worldSetting) return false
  if (!(shortDrama as any).characterSetting) return false
  return true
}

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

  if (storyId) {
    const db = await getDb({ stories })
    const [row] = await db.select({ metadata: stories.metadata }).from(stories).where(eq(stories.id, storyId)).limit(1)
    const metadata = (row?.metadata ?? {}) as Record<string, unknown>
    if (!isShortDramaReady(metadata)) {
      const qs = new URLSearchParams()
      const next = `/video?tab=${encodeURIComponent(initialTab)}&storyId=${encodeURIComponent(storyId)}${outlineId ? `&outlineId=${encodeURIComponent(outlineId)}` : ""}`
      qs.set("next", next)
      redirect(`/script/short-drama/${encodeURIComponent(storyId)}?${qs.toString()}`)
    }
  }

  return (
    <Suspense fallback={null}>
      <VideoPageClient initialTab={initialTab} initialStoryId={storyId} initialOutlineId={outlineId} />
    </Suspense>
  )
}
