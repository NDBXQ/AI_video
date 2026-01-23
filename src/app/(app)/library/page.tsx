import type { ReactElement } from "react"
import { Suspense } from "react"
import { ContentLibraryPage } from "@/features/library/ContentLibraryPage"

export const dynamic = "force-dynamic"

export default function LibraryPage(): ReactElement {
  return (
    <Suspense fallback={<div />}>
      <ContentLibraryPage />
    </Suspense>
  )
}
