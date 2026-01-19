import type { ReactElement } from "react"
import { ImageCreatePage } from "@/features/video/components/ImageCreatePage"
import styles from "./page.module.css"

/**
 * 生图子界面路由
 * @param {Object} props - 页面属性
 * @param {Record<string, string | string[] | undefined>} props.searchParams - URL 查询参数
 * @returns {ReactElement} 页面内容
 */
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
      <ImageCreatePage sceneNo={sceneNo} />
    </main>
  )
}
