"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "./ShortDramaSetupPage.module.css"
import { ShortDramaPanel } from "../workspace/components/shortDrama/ShortDramaPanel"

type ShortDramaSetupPageProps = Readonly<{
  storyId: string
  storyMetadata?: Record<string, unknown>
}>

function isShortDramaReady(shortDrama: any): boolean {
  if (!shortDrama || typeof shortDrama !== "object") return false
  if (typeof (shortDrama as any).planningConfirmedAt !== "number") return false
  if (!(shortDrama as any).planningResult) return false
  if (!(shortDrama as any).worldSetting) return false
  if (!(shortDrama as any).characterSetting) return false
  return true
}

export function ShortDramaSetupPage({ storyId, storyMetadata }: ShortDramaSetupPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || ""

  const [shortDrama, setShortDrama] = useState<any>(() => (storyMetadata as any)?.shortDrama ?? {})
  const ready = useMemo(() => isShortDramaReady(shortDrama), [shortDrama])

  const continueUrl = (() => {
    if (next && next.startsWith("/")) return next
    return `/script/workspace/${encodeURIComponent(storyId)}?mode=brief`
  })()

  return (
    <main className={styles.container}>
      <section className={styles.header} aria-label="短剧信息设置">
        <div className={styles.headerMain}>
          <div className={styles.title}>短剧信息</div>
          <div className={styles.subTitle}>
            完成剧本策划确认后，再并行生成世界观与角色设定。全部完成后进入下一步（剧本大纲 / 分镜 / 生图 / 生视频）。
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => router.push(`/script/workspace/${encodeURIComponent(storyId)}?mode=brief`)}
          >
            返回工作台
          </button>
          <button type="button" className={styles.primaryBtn} disabled={!ready} onClick={() => router.push(continueUrl)}>
            继续下一步
          </button>
        </div>
      </section>

      <section className={styles.panelCard}>
        <ShortDramaPanel storyId={storyId} shortDrama={shortDrama} onShortDramaUpdate={setShortDrama} />
      </section>
    </main>
  )
}

