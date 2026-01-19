import type { ReactElement } from "react"
import { VideoCreatePage } from "@/features/video/components/VideoCreatePage"
import styles from "./page.module.css"

export default function Page({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>
}): ReactElement {
  const raw = searchParams.sceneNo
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? "1", 10)
  const sceneNo = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  return (
    <main className={styles.container}>
      <VideoCreatePage sceneNo={sceneNo} />
    </main>
  )
}

