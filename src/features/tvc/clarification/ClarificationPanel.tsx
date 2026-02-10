"use client"

import type { ReactElement } from "react"
import type { ClarificationUiState } from "./types"
import { TvcMarkdown } from "@/features/tvc/script/components/TvcMarkdown"
import styles from "./ClarificationPanel.module.css"

export function ClarificationPanel({
  clarification,
  variant = "standalone"
}: {
  clarification: ClarificationUiState
  variant?: "standalone" | "embedded"
}): ReactElement | null {
  if (!clarification?.text?.trim()) return null
  if (variant === "embedded") {
    return (
      <div className={styles.body} aria-label="需求澄清">
        <TvcMarkdown markdown={clarification.text} />
      </div>
    )
  }
  return (
    <div className={styles.card} aria-label="需求澄清">
      <div className={styles.header}>
        <div className={styles.title}>需求澄清</div>
        <div className={styles.badge}>{clarification.done ? "已完成" : "收集中"}</div>
      </div>
      <div className={styles.body}>
        <TvcMarkdown markdown={clarification.text} />
      </div>
    </div>
  )
}
