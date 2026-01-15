import type { Metadata } from "next"
import type { ReactElement, ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "ai-video",
  description: "AI video app"
}

/**
 * 根布局组件
 * @param {Object} props - 组件属性
 * @param {ReactNode} props.children - 子节点
 * @returns {ReactElement} 应用根布局
 */
export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>): ReactElement {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
