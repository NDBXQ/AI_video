import styles from "./ImagePreviewSidebar.module.css"

type Props = {
  title: string
  description: string
  isEditing: boolean
  editPrompt: string
  onEditPromptChange: (v: string) => void
  hasSelection: boolean
  onGenerate: () => void
  onExitEdit: () => void
  onRegenerate: () => void
  onSave: () => void
  loading: boolean
  regenerating: boolean
  saving: boolean
  saveDone: boolean
  saveError?: string | null
  regenerateError?: string | null
  deleteError?: string | null
  inpaintError?: string | null
  onClose: () => void
  canRegenerate: boolean
  publicResourceId?: string | null
  onDelete?: () => void
  deleting?: boolean
}

export function ImagePreviewSidebar({
  title,
  description,
  isEditing,
  editPrompt,
  onEditPromptChange,
  hasSelection,
  onGenerate,
  onExitEdit,
  onRegenerate,
  onSave,
  loading,
  regenerating,
  saving,
  saveDone,
  saveError,
  regenerateError,
  deleteError,
  inpaintError,
  onClose,
  canRegenerate,
  publicResourceId,
  onDelete,
  deleting,
}: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          {isEditing || hasSelection ? <div className={styles.title}>区域重绘</div> : null}
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <div className={styles.panel}>
        {isEditing || hasSelection ? (
          <>
            <div className={styles.panelHint}>
              1. 在左侧图片上框选需要修改的区域
              <br />
              2. 在下方描述修改后的画面内容
            </div>
            <textarea
              className={styles.promptInput}
              placeholder="请输入修改提示词，例如：换成红色的衣服..."
              value={editPrompt}
              onChange={(e) => onEditPromptChange(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              className={styles.primaryButton}
              disabled={loading || !hasSelection || !editPrompt.trim()}
              onClick={onGenerate}
            >
              {loading ? "生成中…" : "使用选区生成"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={loading}
              onClick={onExitEdit}
            >
              退出编辑
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={saving || saveDone || !canRegenerate}
              onClick={onSave}
            >
              {saving ? "保存中…" : saveDone ? "已保存" : "保存到公共资源库"}
            </button>
            {publicResourceId && onDelete ? (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting ? "删除中…" : "从公共素材库删除"}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={regenerating || !canRegenerate}
              onClick={onRegenerate}
            >
              {regenerating ? "重新生成中…" : "重新生成"}
            </button>
            <div className={styles.panelHint}>
              后续会在这里增加更多功能，例如下载、复制链接、设置为封面等。
            </div>
          </>
        )}
        {saveError ? <div className={styles.panelError}>{saveError}</div> : null}
        {regenerateError ? <div className={styles.panelError}>{regenerateError}</div> : null}
        {deleteError ? <div className={styles.panelError}>{deleteError}</div> : null}
        {inpaintError ? <div className={styles.panelError}>{inpaintError}</div> : null}
        <div className={styles.metaTitle}>{title}</div>
        <div className={styles.metaDescription}>{description}</div>
      </div>
    </div>
  )
}
