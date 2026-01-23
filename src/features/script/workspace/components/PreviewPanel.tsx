
"use client"

import styles from "./PreviewPanel.module.css"
import type { RewriteState, OutlineItem } from "../utils"
import { deriveLiveRewrite } from "../utils"

type PreviewPanelProps = Readonly<{
  activeOutline: OutlineItem | null
  previewMode: "original" | "rewrite"
  setPreviewMode: (mode: "original" | "rewrite") => void
  canShowRewrite: boolean
  activeRewrite: RewriteState | undefined
  activeDraft: { content: string } | null
  generatingStoryboard: boolean
  handleGenerateStoryboardText: () => void
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
  handleGenerateStoryboardText
}: PreviewPanelProps) {
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
          <div className={styles.previewHint}>可在此查看生成内容</div>
        </div>
      </div>

      <article className={styles.markdown}>
        {activeOutline ? (
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
        )}
      </article>

      <div className={styles.nextStep}>
        <div className={styles.nextStepCard}>
          <div className={styles.nextStepText}>
            <div className={styles.nextStepTitle}>下一步：生成分镜文本</div>
            <div className={styles.nextStepDesc}>基于当前大纲生成更细的场景描述与镜头文本，准备进入视频创作。</div>
          </div>
          <button
            type="button"
            className={styles.nextStepButton}
            onClick={handleGenerateStoryboardText}
            disabled={!activeOutline || generatingStoryboard}
          >
            {generatingStoryboard ? "生成中…" : "生成分镜"}
          </button>
        </div>
      </div>
    </section>
  )
}
