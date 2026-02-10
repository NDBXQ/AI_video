"use client"

import type { CSSProperties, ReactElement } from "react"
import { useMemo, useState } from "react"
import styles from "./StoryContentModal.module.css"

export function StoryContentExpandableText({
  text,
  clampLines = 8,
  collapsedMinChars = 240
}: {
  text: string
  clampLines?: number
  collapsedMinChars?: number
}): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const normalized = useMemo(() => (text ?? "").trim(), [text])
  const canToggle = normalized.length >= collapsedMinChars
  const clampStyle = useMemo(() => ({ ["--clamp-lines" as string]: clampLines } as CSSProperties), [clampLines])
  const className = `${styles.prose} ${!expanded && canToggle ? styles.clamp : ""}`

  return (
    <div>
      <div className={className} style={!expanded && canToggle ? clampStyle : undefined}>
        {normalized}
      </div>
      {canToggle ? (
        <div className={styles.expandRow}>
          <button type="button" className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起" : "展开"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

