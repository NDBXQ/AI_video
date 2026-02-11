import { asc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { notFound, redirect } from "next/navigation"
import type { ReactElement } from "react"
import { ScriptWorkspacePage } from "@/features/script/workspace/ScriptWorkspacePage"
import { stories, storyOutlines } from "@/shared/schema"

type ScriptWorkspaceStoryRouteProps = Readonly<{
  params:
    | Readonly<{
        storyId: string
      }>
    | Promise<
        Readonly<{
          storyId: string
        }>
      >
  searchParams?:
    | Readonly<{
        mode?: string | string[]
        outline?: string | string[]
      }>
    | Promise<
        Readonly<{
          mode?: string | string[]
          outline?: string | string[]
        }>
      >
}>

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

export default async function ScriptWorkspaceStoryRoutePage({
  params,
  searchParams
}: ScriptWorkspaceStoryRouteProps): Promise<ReactElement> {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams)

  const storyId = resolvedParams.storyId?.trim()
  if (!storyId) notFound()

  const modeValue = resolvedSearchParams?.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue

  const outlineValue = resolvedSearchParams?.outline
  const outline = Array.isArray(outlineValue) ? outlineValue[0] : outlineValue

  const db = await getDb({ storyOutlines, stories })
  const storyRows = await db.select({ metadata: stories.metadata }).from(stories).where(eq(stories.id, storyId)).limit(1)
  const storyMetadata = (storyRows[0]?.metadata ?? {}) as Record<string, unknown>
  if (mode !== "source" && !isShortDramaReady(storyMetadata)) {
    const qs = new URLSearchParams()
    const next = `/script/workspace/${encodeURIComponent(storyId)}${outline ? `?mode=brief&outline=${encodeURIComponent(outline)}` : "?mode=brief"}`
    qs.set("next", next)
    redirect(`/script/short-drama/${encodeURIComponent(storyId)}?${qs.toString()}`)
  }
  const rows = await db
    .select()
    .from(storyOutlines)
    .where(eq(storyOutlines.storyId, storyId))
    .orderBy(asc(storyOutlines.sequence))

  const outlines = rows.map((row) => {
    return {
      outlineId: row.id,
      sequence: row.sequence,
      outlineText: row.outlineText,
      originalText: row.originalText,
      outlineDrafts: (row as any).outlineDrafts ?? [],
      activeOutlineDraftId: (row as any).activeOutlineDraftId ?? null
    }
  })

  return (
    <ScriptWorkspacePage
      mode={mode === "source" ? "source" : "brief"}
      storyId={storyId}
      outline={outline}
      outlines={outlines}
      storyMetadata={storyMetadata}
    />
  )
}
