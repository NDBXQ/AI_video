import type { ReactElement, ReactNode } from "react"
import styles from "./layout.module.css"

/**
 * 鉴权相关页面布局（无顶部导航）
 * @param {Object} props - 组件属性
 * @param {ReactNode} props.children - 子节点
 * @returns {ReactElement} 布局内容
 */
export default function AuthLayout({
  children
}: Readonly<{
  children: ReactNode
}>): ReactElement {
  return <div className={styles.shell}>{children}</div>
}
