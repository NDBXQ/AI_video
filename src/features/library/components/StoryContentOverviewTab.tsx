"use client"

import type { ReactElement } from "react"
import styles from "./StoryContentModal.module.css"
import type { Outline, StoryDetail } from "./storyContentTypes"
import { StoryContentExpandableText } from "./StoryContentExpandableText"
import { getShotStyleLabel } from "@/shared/shotStyle"

export function StoryContentOverviewTab({ story, outlines }: { story: StoryDetail | null; outlines: Outline[] }): ReactElement {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>基础信息</div>
        <div className={styles.kvRow}>
          <div className={styles.kvKey}>ID</div>
          <div className={styles.kvVal}>{story?.id ?? ""}</div>
        </div>
        <div className={styles.kvRow}>
          <div className={styles.kvKey}>分辨率</div>
          <div className={styles.kvVal}>{story ? `${story.aspectRatio} ｜ ${story.resolution}` : ""}</div>
        </div>
        <div className={styles.kvRow}>
          <div className={styles.kvKey}>阶段</div>
          <div className={styles.kvVal}>{story?.progressStage ?? ""}</div>
        </div>
        <div className={styles.kvRow}>
          <div className={styles.kvKey}>风格</div>
          <div className={styles.kvVal}>{getShotStyleLabel(story?.shotStyle)}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>简介/原文</div>
        <div className={styles.kvRow}>
          <div className={styles.kvKey}>原文</div>
          <div className={styles.kvVal}>
            {story?.storyText ? <StoryContentExpandableText text={story.storyText} clampLines={8} /> : null}
          </div>
        </div>
        {story?.generatedText ? (
          <div className={styles.kvRow}>
            <div className={styles.kvKey}>生成文案</div>
            <div className={styles.kvVal}>
              <StoryContentExpandableText text={story.generatedText} clampLines={10} />
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>大纲</div>
        {outlines.length === 0 ? (
          <div className={styles.muted}>暂无大纲</div>
        ) : (
          outlines.map((o) => (
            <div key={o.id} className={styles.kvRow}>
              <div className={styles.kvKey}>{`第${o.sequence}集`}</div>
              <div className={styles.kvVal}>
                {o.originalText || o.outlineText ? <StoryContentExpandableText text={o.originalText || o.outlineText} clampLines={6} /> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
