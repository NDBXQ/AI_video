import type { ReactElement } from "react"
import { TvcWorkspacePage } from "@/features/tvc/pages/TvcWorkspacePage"
import { TvcPagePadding } from "@/features/tvc/components/TvcPagePadding"

export default function TvcPage(): ReactElement {
  return (
    <>
      <TvcPagePadding />
      <TvcWorkspacePage />
    </>
  )
}
