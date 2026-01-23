import type { ReactElement } from "react"
import { CreateWorkspacePage } from "@/features/video/components/CreateWorkspacePage"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

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
