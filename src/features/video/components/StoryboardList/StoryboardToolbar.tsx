import { type ReactElement } from "react"
import styles from "./StoryboardToolbar.module.css"

type StoryboardToolbarProps = {
  totalCount: number
  isLoading: boolean
  loadError: string | null
  selectedCount: number
  isAnyScriptGenerating: boolean
  scriptGenerateSummary: { total: number; generating: number; done: number }
  onBatchDelete: () => void
  onGenerateScript: () => void
}

export function StoryboardToolbar({
  totalCount,
  isLoading,
  loadError,
  selectedCount,
  isAnyScriptGenerating,
  scriptGenerateSummary,
  onBatchDelete,
  onGenerateScript
}: StoryboardToolbarProps): ReactElement {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <h2 className={styles.toolbarTitle}>分镜脚本</h2>
        <span className={styles.toolbarMeta}>共 {totalCount} 个镜头</span>
        {isLoading ? <span className={styles.toolbarMeta}>加载中…</span> : null}
        {loadError ? <span className={styles.toolbarMeta}>{loadError}</span> : null}
      </div>
      <div className={styles.toolbarActions}>
        {selectedCount > 0 && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onBatchDelete}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            删除 ({selectedCount})
          </button>
        )}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={isLoading || isAnyScriptGenerating}
          style={{ opacity: isLoading || isAnyScriptGenerating ? 0.75 : 1, cursor: isLoading || isAnyScriptGenerating ? "not-allowed" : "pointer" }}
          onClick={onGenerateScript}
        >
          ⚡️ AI 生成脚本{isAnyScriptGenerating ? `（${scriptGenerateSummary.done}/${scriptGenerateSummary.total}）` : ""}
        </button>
      </div>
    </div>
  )
}
