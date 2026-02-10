"use client"

import type { ReactElement } from "react"
import styles from "./StoryContentModal.module.css"
import type { Outline, Shot } from "./storyContentTypes"
import { StoryContentExpandableText } from "./StoryContentExpandableText"

export function StoryContentStoryboardsTab({
  outlines,
  shotsByOutlineId
}: {
  outlines: Outline[]
  shotsByOutlineId: Record<string, Shot[]>
}): ReactElement {
  return (
    <>
      {outlines.length === 0 ? <div className={styles.muted}>暂无分镜</div> : null}
      {outlines.map((o) => {
        const shots = shotsByOutlineId[o.id] ?? []
        return (
          <div key={o.id} className={styles.section}>
            <div className={styles.sectionTitle}>{`第${o.sequence}集 · 分镜（${shots.length}）`}</div>
            {shots.length === 0 ? <div className={styles.muted}>暂无分镜</div> : null}
            {shots.map((s) => (
              <div key={s.id} className={styles.shotCard}>
                <div className={styles.shotHeader}>
                  <div className={styles.shotTitle}>{`第${s.sequence}镜`}</div>
                  <div className={styles.shotMeta}>{s.shotCut ? "切镜" : ""}</div>
                </div>
                {s.storyboardText ? <StoryContentExpandableText text={s.storyboardText} clampLines={8} /> : <div className={styles.muted}>暂无文案</div>}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
