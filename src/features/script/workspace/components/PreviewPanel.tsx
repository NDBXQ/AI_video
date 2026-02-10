
"use client"

import { useState } from "react"
import styles from "./PreviewPanel.module.css"
import type { RewriteState, OutlineItem } from "../utils"
import { deriveLiveRewrite } from "../utils"
import { ShortDramaPanel } from "./shortDrama/ShortDramaPanel"

type PreviewPanelProps = Readonly<{
  activeOutline: OutlineItem | null
  previewMode: "original" | "rewrite"
  setPreviewMode: (mode: "original" | "rewrite") => void
  canShowRewrite: boolean
  activeRewrite: RewriteState | undefined
  activeDraft: { content: string } | null
  generatingStoryboard: boolean
  handleGenerateStoryboardText: () => void
  handleManualGenerate: () => void
  storyId: string
  shortDrama?: any
  onShortDramaUpdate?: (next: any) => void
}>

/**
 * 中间预览区组件
 * @param {PreviewPanelProps} props - 组件属性
 * @returns {JSX.Element} 组件内容
 */
export function PreviewPanel({
  activeOutline,
  previewMode,
  setPreviewMode,
  canShowRewrite,
  activeRewrite,
  activeDraft,
  generatingStoryboard,
  handleGenerateStoryboardText,
  handleManualGenerate,
  storyId,
  shortDrama,
  onShortDramaUpdate
}: PreviewPanelProps) {
  const [showShortDrama, setShowShortDrama] = useState(false)
  const hasShortDrama = Boolean(shortDrama && typeof shortDrama === "object")
  const shortDramaObj = hasShortDrama ? (shortDrama as any) : {}

  return (
    <section className={styles.preview}>
      <div className={styles.previewHeader}>
        <div className={styles.previewTitle}>{activeOutline ? `剧本大纲 ${activeOutline.sequence}` : "暂无大纲"}</div>
        <div className={styles.previewActions}>
          {activeOutline ? (
            <>
              <button
                type="button"
                className={previewMode === "original" ? `${styles.toggleButton} ${styles.toggleButtonActive}` : styles.toggleButton}
                onClick={() => setPreviewMode("original")}
              >
                原文
              </button>
              <button
                type="button"
                className={previewMode === "rewrite" ? `${styles.toggleButton} ${styles.toggleButtonActive}` : styles.toggleButton}
                disabled={!canShowRewrite}
                onClick={() => setPreviewMode("rewrite")}
              >
                改写
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={showShortDrama ? `${styles.toggleButton} ${styles.toggleButtonActive}` : styles.toggleButton}
            disabled={!hasShortDrama}
            onClick={() => setShowShortDrama((v) => !v)}
          >
            短剧信息
          </button>
          <div className={styles.previewHint}>可在此查看生成内容</div>
        </div>
      </div>

      <article className={styles.markdown}>
        {showShortDrama && hasShortDrama ? (
          <div className={styles.shortDramaPanel}>
            <div className={styles.shortDramaCard}>
              <div className={styles.shortDramaCardTitle}>短剧信息</div>
              <ShortDramaPanel
                storyId={storyId}
                shortDrama={shortDramaObj}
                onShortDramaUpdate={(next) => {
                  onShortDramaUpdate?.(next)
                }}
              />
            </div>
          </div>
        ) : null}
        {!showShortDrama ? (
          activeOutline ? (
            (() => {
              if (previewMode === "rewrite") {
                if (activeRewrite?.status === "streaming") {
                  if (activeRewrite?.raw) {
                    const live = deriveLiveRewrite(activeRewrite.raw)
                    return <div className={styles.streamText}>{live.content ?? activeRewrite.raw}</div>
                  }
                  return <div className={styles.originalEmpty}>改写中…</div>
                }
                const content = activeDraft?.content?.trim() || activeRewrite?.result?.new_content?.trim() || ""
                return content ? <div className={styles.streamText}>{content}</div> : <div className={styles.originalEmpty}>暂无改写内容</div>
              }
              return <div className={styles.originalText}>{activeOutline.originalText}</div>
            })()
          ) : (
            <div className={styles.originalEmpty}>暂无可展示内容</div>
          )
        ) : null}
      </article>

      {!showShortDrama ? (
        <div className={styles.nextStep}>
          <div className={styles.nextStepCard}>
            <div className={styles.nextStepText}>
              <div className={styles.nextStepTitle}>下一步：生成分镜文本</div>
              <div className={styles.nextStepDesc}>基于当前大纲生成更细的场景描述与镜头文本，准备进入视频创作。</div>
            </div>
            <div className={styles.nextStepAction}>
              <button
                type="button"
                className={styles.nextStepButton}
                onClick={handleGenerateStoryboardText}
                disabled={!activeOutline || generatingStoryboard}
              >
                {generatingStoryboard ? "生成中…" : "一键生成"}
              </button>
              <button
                type="button"
                className={styles.nextStepButtonSecondary}
                onClick={handleManualGenerate}
                disabled={!activeOutline || generatingStoryboard}
              >
                手动生成
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
