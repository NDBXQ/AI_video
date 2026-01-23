import { type ReactElement } from "react"
import type { StoryboardItem } from "../../types"
import type { ScriptGenerateState } from "../../hooks/useScriptGeneration"
import styles from "./StoryboardTableRow.module.css"

type StoryboardTableRowProps = {
  item: StoryboardItem
  isSelected: boolean
  generationState?: ScriptGenerateState
  onSelect: (id: string) => void
  previews?: {
    role: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
    background: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
    item: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
  }
  onPreviewImage: (
    title: string,
    imageSrc: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => void
  onOpenEdit: (itemId: string, initialValue: string) => void
  onDelete: (id: string) => void
}

export function StoryboardTableRow({
  item,
  isSelected,
  generationState,
  onSelect,
  previews,
  onPreviewImage,
  onOpenEdit,
  onDelete
}: StoryboardTableRowProps): ReactElement {
  const hintText =
    generationState && generationState.status !== "idle"
      ? generationState.message ?? (generationState.status === "generating" ? "脚本生成中…" : generationState.status === "success" ? "已生成" : "生成失败")
      : ""
  const hintToneClass =
    generationState?.tone === "error" ? styles.scriptHintError : generationState?.tone === "warn" ? styles.scriptHintWarn : styles.scriptHintInfo

  const renderPreviewStack = (
    list: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>
  ) => {
    const visible = list.slice(0, 3)
    const rest = Math.max(0, list.length - visible.length)
    return (
      <div className={styles.previewStack}>
        {visible.map((img) => (
          <button
            key={img.id}
            type="button"
            className={styles.previewThumb}
            onClick={() => onPreviewImage(img.name, img.url, img.id, img.storyboardId ?? item.id, img.category ?? null, img.description, img.prompt)}
            aria-label={`预览 ${img.name}`}
          >
            <img className={styles.previewThumbImg} src={img.thumbnailUrl ?? img.url} alt={img.name} />
          </button>
        ))}
        {rest > 0 ? (
          <div className={`${styles.previewThumb} ${styles.previewThumbMore}`}>+{rest}</div>
        ) : list.length === 0 ? (
          <div className={`${styles.previewThumb} ${styles.previewThumbEmpty}`}>+</div>
        ) : null}
      </div>
    )
  }

  return (
    <tr>
      <td className={styles.colCheckbox}>
        <input type="checkbox" checked={isSelected} onChange={() => onSelect(item.id)} />
      </td>
      <td className={styles.colNo}>
        <span className={styles.sceneNo}>{item.scene_no}</span>
      </td>
      <td className={styles.colVisual}>
        <div className={styles.visualContent}>
          {item.storyboard_text ? <div className={styles.storyboardText}>{item.storyboard_text}</div> : null}
          {hintText ? <div className={`${styles.scriptHint} ${hintToneClass}`}>{hintText}</div> : null}
        </div>
      </td>
      <td className={styles.colRole}>
        {renderPreviewStack(previews?.role ?? [])}
      </td>
      <td className={styles.colBackground}>
        {renderPreviewStack(previews?.background ?? [])}
      </td>
      <td className={styles.colItems}>
        {renderPreviewStack(previews?.item ?? [])}
      </td>
      <td className={styles.colActions}>
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.actionBtn}
            title="预览"
            onClick={() => onOpenEdit(item.id, item.storyboard_text ?? "")}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          <button className={styles.actionBtn} title="上移">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button className={styles.actionBtn} title="下移">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(item.id)} title="删除">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
