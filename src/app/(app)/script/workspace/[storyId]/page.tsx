import { asc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { notFound } from "next/navigation"
import type { ReactElement } from "react"
import { ScriptWorkspacePage } from "@/features/script/workspace/ScriptWorkspacePage"
import { storyOutlines } from "@/shared/schema"

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

  const db = await getDb({ storyOutlines })
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
    />
  )
}
