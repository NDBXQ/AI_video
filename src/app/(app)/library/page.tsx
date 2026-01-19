import { redirect } from "next/navigation"
import type { ReactElement } from "react"

export default function LibraryPage(): ReactElement {
  redirect("/library/roles")
}


