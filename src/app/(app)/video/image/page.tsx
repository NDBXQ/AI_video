import type { ReactElement } from "react"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import { CreateWorkspacePage } from "@/features/video/components/CreateWorkspacePage"
import styles from "./page.module.css"
import { stories } from "@/shared/schema"

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

/**
 * 生图子界面路由
 * @param {Object} props - 页面属性
 * @param {Record<string, string | string[] | undefined>} props.searchParams - URL 查询参数
 * @returns {ReactElement} 页面内容
 */
export default async function Page({
  searchParams
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
}): Promise<ReactElement> {
  const resolvedSearchParams = await Promise.resolve(searchParams)

  const rawStoryboardId = resolvedSearchParams.storyboardId
  const storyboardId = Array.isArray(rawStoryboardId) ? rawStoryboardId[0] : rawStoryboardId

  const rawStoryId = resolvedSearchParams.storyId
  const storyId = Array.isArray(rawStoryId) ? rawStoryId[0] : rawStoryId

  const rawOutlineId = resolvedSearchParams.outlineId
  const outlineId = Array.isArray(rawOutlineId) ? rawOutlineId[0] : rawOutlineId

  const raw = resolvedSearchParams.sceneNo
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? "1", 10)
  const sceneNo = Number.isFinite(parsed) && parsed > 0 ? parsed : 1

  if (storyId) {
    const db = await getDb({ stories })
    const [row] = await db.select({ metadata: stories.metadata }).from(stories).where(eq(stories.id, storyId)).limit(1)
    const metadata = (row?.metadata ?? {}) as Record<string, unknown>
    if (!isShortDramaReady(metadata)) {
      const qs = new URLSearchParams()
      const next = `/video/image?storyId=${encodeURIComponent(storyId)}${outlineId ? `&outlineId=${encodeURIComponent(outlineId)}` : ""}${
        storyboardId ? `&storyboardId=${encodeURIComponent(storyboardId)}` : ""
      }&sceneNo=${encodeURIComponent(String(sceneNo))}`
      qs.set("next", next)
      redirect(`/script/short-drama/${encodeURIComponent(storyId)}?${qs.toString()}`)
    }
  }

  return (
    <main className={styles.container}>
      <CreateWorkspacePage
        initialTab="image"
        sceneNo={sceneNo}
        storyboardId={storyboardId}
        storyId={storyId}
        outlineId={outlineId}
      />
    </main>
  )
}
