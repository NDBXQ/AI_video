import type { ReactElement } from "react"
import { redirect } from "next/navigation"
import { ScriptWorkspaceLanding } from "@/features/script/workspace/ScriptWorkspaceLanding"

type ScriptWorkspaceRouteProps = Readonly<{
  searchParams: Promise<Readonly<{
    entry?: string | string[]
    mode?: string | string[]
    outline?: string | string[]
    storyId?: string | string[]
  }>>
}>

export const dynamic = "force-dynamic"

export default async function ScriptWorkspaceRoutePage({
  searchParams
}: ScriptWorkspaceRouteProps): Promise<ReactElement> {
  const params = await searchParams
  const entryValue = params.entry
  const entry = Array.isArray(entryValue) ? entryValue[0] : entryValue
  const modeValue = params.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue
  const outlineValue = params.outline
  const outline = Array.isArray(outlineValue) ? outlineValue[0] : outlineValue
  const storyIdValue = params.storyId
  const storyId = Array.isArray(storyIdValue) ? storyIdValue[0] : storyIdValue

  const m = mode === "source" ? "source" : "brief"

  if (storyId && storyId.trim()) {
    const outlineQuery = outline ? `&outline=${encodeURIComponent(outline)}` : ""
    redirect(`/script/workspace/${encodeURIComponent(storyId.trim())}?mode=${m}${outlineQuery}`)
  }

  return <ScriptWorkspaceLanding entry={entry} mode={m} />
}
