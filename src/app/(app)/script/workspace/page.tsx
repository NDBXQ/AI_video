import type { ReactElement } from "react"
import { redirect } from "next/navigation"

type ScriptWorkspaceRouteProps = Readonly<{
  searchParams?: Readonly<{
    mode?: string | string[]
    outline?: string | string[]
    storyId?: string | string[]
  }>
}>

export const dynamic = "force-dynamic"

export default function ScriptWorkspaceRoutePage({
  searchParams
}: ScriptWorkspaceRouteProps): ReactElement {
  const modeValue = searchParams?.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue
  const outlineValue = searchParams?.outline
  const outline = Array.isArray(outlineValue) ? outlineValue[0] : outlineValue
  const storyIdValue = searchParams?.storyId
  const storyId = Array.isArray(storyIdValue) ? storyIdValue[0] : storyIdValue

  if (storyId && storyId.trim()) {
    const m = mode === "source" ? "source" : "brief"
    const outlineQuery = outline ? `&outline=${encodeURIComponent(outline)}` : ""
    redirect(`/script/workspace/${encodeURIComponent(storyId.trim())}?mode=${m}${outlineQuery}`)
  }

  redirect("/script")
}
