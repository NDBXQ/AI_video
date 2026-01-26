import { type ReactElement } from "react"
import type { StoryboardItem } from "../../types"
import type { ScriptGenerateState } from "../../hooks/useScriptGeneration"
import styles from "./StoryboardTableRow.module.css"
import { createPreviewSvgDataUrl } from "../../utils/svgUtils"
import { extractReferenceImagePrompts } from "../../utils/referenceImagePrompts"

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
  onPickAsset: (params: { storyboardId: string; category: "role" | "background" | "item"; title: string; entityName: string }) => void
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
  onPickAsset,
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
    list: Array<{ id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; description?: string | null; prompt?: string | null }>,
    kind: "role" | "background" | "item",
    label: string
  ) => {
    const visible = list.slice(0, 3)
    const rest = Math.max(0, list.length - visible.length)
    const extracted = extractReferenceImagePrompts(item.scriptContent)
    const firstByKind = extracted.find((p) => p.category === kind) ?? null

    const shouldShowPlaceholder = (() => {
      if (kind === "role") {
        const roles = Array.isArray(item.shot_content?.roles) ? item.shot_content.roles : []
        const isNarrator = (name: string) => {
          const n = name.trim()
          if (!n) return false
          return n === "旁白" || n.toLowerCase() === "narrator"
        }
        const nonNarratorCount = roles.filter((r) => r && typeof r.role_name === "string" && !isNarrator(r.role_name)).length
        return nonNarratorCount > 0
      }
      if (kind === "item") {
        const roleItems = Array.isArray(item.shot_content?.role_items) ? item.shot_content.role_items.length : 0
        const otherItems = Array.isArray(item.shot_content?.other_items) ? item.shot_content.other_items.length : 0
        return roleItems + otherItems > 0
      }
      return true
    })()

    const fallbackName = (() => {
      if (kind === "background") return item.shot_content?.background?.background_name?.trim() || label
      if (kind === "role") return item.shot_content?.roles?.[0]?.role_name?.trim() || label
      const roleItem = Array.isArray(item.shot_content?.role_items) ? item.shot_content.role_items[0] : ""
      const otherItem = Array.isArray(item.shot_content?.other_items) ? item.shot_content.other_items[0] : ""
      return (typeof roleItem === "string" && roleItem.trim()) || (typeof otherItem === "string" && otherItem.trim()) || label
    })()

    const entityTitle = (firstByKind?.name ?? "").trim() || fallbackName
    const entityDescription = (firstByKind?.description ?? "").trim() || (firstByKind?.prompt ?? "").trim() || ""
    const entityPrompt = (firstByKind?.prompt ?? "").trim() || ""

    const placeholderSrc = createPreviewSvgDataUrl(entityTitle, `镜头 ${item.scene_no} · ${label} · 未生成`)
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
        {rest > 0 ? <div className={`${styles.previewThumb} ${styles.previewThumbMore}`}>+{rest}</div> : null}
        {list.length === 0 && shouldShowPlaceholder ? (
          <button
            type="button"
            className={`${styles.previewThumb} ${styles.previewThumbPlaceholder}`}
            aria-label={`预览 镜头${item.scene_no}-${label}`}
            onClick={() => onPreviewImage(entityTitle, placeholderSrc, undefined, item.id, kind, entityDescription || null, entityPrompt || null)}
          >
            <img className={`${styles.previewThumbImg} ${styles.previewThumbPlaceholderImg}`} src={placeholderSrc} alt="" />
          </button>
        ) : null}
        {kind !== "background" ? (
          <button
            type="button"
            className={`${styles.previewThumb} ${styles.previewThumbEmpty}`}
            aria-label={`为镜头 ${item.scene_no} 添加${label}素材`}
            onClick={() => onPickAsset({ storyboardId: item.id, category: kind, title: `镜头${item.scene_no}-${label}`, entityName: entityTitle })}
          >
            +
          </button>
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
        {renderPreviewStack(previews?.role ?? [], "role", "角色")}
      </td>
      <td className={styles.colBackground}>
        {renderPreviewStack(previews?.background ?? [], "background", "背景")}
      </td>
      <td className={styles.colItems}>
        {renderPreviewStack(previews?.item ?? [], "item", "物品")}
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
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(item.id)} title="删除">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
