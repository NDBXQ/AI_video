"use client"

import type { ReactElement } from "react"
import styles from "../TvcChatPanel.module.css"

export function ChatHeader({ streaming, statusText }: { streaming: boolean; statusText?: string }): ReactElement {
  const detail = String(statusText ?? "").trim()
  return (
    <div className={styles.header}>
      <div className={styles.title}>TVC Assistant</div>
      <div className={styles.statusRow}>
        <div className={styles.status}>{streaming ? "生成中" : "可输入"}</div>
        {streaming && detail ? (
          <div className={`${styles.status} ${styles.statusDetail}`} title={detail}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}
