import type { ReactElement } from "react"
import { Pencil, Film, FileText, Image as ImageIcon, Eye, Music, LayoutGrid } from "lucide-react"
import Image from "next/image"
import styles from "./LibraryCard.module.css"
import type { LibraryItem } from "@/shared/contracts/library/libraryItem"

export type { LibraryItem } from "@/shared/contracts/library/libraryItem"

interface LibraryCardProps {
  item: LibraryItem
  view: "grid" | "list"
  onClick?: () => void
  selected?: boolean
  onToggleSelected?: () => void
  onViewContent?: () => void
}

export function LibraryCard({ item, view, onClick, selected, onToggleSelected, onViewContent }: LibraryCardProps): ReactElement {
  const variant = item.scope === "public" ? "library" : item.scope ?? "my"
  const showMyCheckbox = variant === "my" && Boolean(onToggleSelected)

  const previewUrl = item.thumbnail
  const previewKind = (() => {
    if (!previewUrl) return "none"
    if (variant === "library" || variant === "shared") {
      if (item.publicCategory === "videos") return "video"
      if (item.publicCategory === "audios") return "audio"
      return "image"
    }
    if (previewUrl.startsWith("data:image/")) return "image"
    const noHash = previewUrl.split("#")[0] ?? previewUrl
    const noQuery = noHash.split("?")[0] ?? noHash
    const lower = noQuery.toLowerCase()
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg")) {
      return "image"
    }
    if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return "video"
    if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".ogg")) return "audio"
    return "unknown"
  })()
  const isAudio = previewKind === "audio"
  const isList = view === "list" || isAudio

  const isStablePublicResourceUrl = Boolean(
    previewUrl?.startsWith("/api/library/public-resources/file/") || previewUrl?.startsWith("/api/library/shared-resources/file/")
  )
  
  const TypeIcon = {
    draft: Pencil,
    video: Film,
    storyboard: FileText,
    material: ImageIcon,
    tvc: LayoutGrid,
  }[item.type]


  const stageLabel =
    item.type === "tvc"
      ? null
      :
    item.progressStage === "outline"
      ? "大纲"
      : item.progressStage === "storyboard_text"
        ? "分镜文本"
        : item.progressStage === "video_script"
          ? "脚本"
          : item.progressStage === "image_assets"
            ? "图片素材"
            : item.progressStage === "video_assets"
              ? "视频生成"
              : item.progressStage === "done"
                ? "完成"
                : item.progressStage
                  ? "未知"
                  : null

  return (
    <div 
      className={`${styles.card} ${isList ? styles.cardList : ""} ${isAudio ? styles.cardAudioFlat : ""}`} 
      onClick={onClick}
    >
      <div
        className={`${styles.preview} ${previewKind === "audio" ? styles.previewAudio : ""} ${previewKind === "video" ? styles.previewVideo : ""}`}
      >
        {previewUrl && previewKind === "image" ? (
          <Image
            src={previewUrl}
            alt={item.title}
            className={styles.previewImage}
            fill
            sizes={isList ? "160px" : "320px"}
            unoptimized={isStablePublicResourceUrl}
          />
        ) : previewUrl && previewKind === "video" ? (
          <div className={`${styles.placeholder} ${styles.placeholderVideo}`}>
            <Film size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        ) : previewUrl && previewKind === "audio" ? (
          <div className={`${styles.placeholder} ${styles.placeholderAudio}`}>
            <Music size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <TypeIcon size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        )}

        {variant === "my" && onViewContent && item.type !== "tvc" ? (
          <button
            type="button"
            className={`${styles.viewContentBtn} ${item.specs ? styles.viewContentBtnShift : ""}`}
            onClick={(e) => {
              e.stopPropagation()
              onViewContent()
            }}
          >
            <Eye size={14} strokeWidth={2} />
            查看内容
          </button>
        ) : null}
        
        {variant === "my" ? (
          <>
            <div className={`${styles.typeTag} ${showMyCheckbox ? styles.typeTagShift : ""}`} title={`progressStage: ${item.progressStage ?? ""}`}>
              <TypeIcon size={12} strokeWidth={2} />
              <span className={styles.typeTagText}>
                {item.type === "tvc" ? "类型：TVC" : stageLabel ? `阶段：${stageLabel}` : ""}
              </span>
            </div>
            {item.specs ? <div className={styles.specTag}>{item.specs}</div> : null}
            {showMyCheckbox ? (
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(selected)}
                onChange={() => onToggleSelected?.()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </>
        ) : null}

        {variant === "library" ? (
          <input
            type="checkbox"
            className={`${styles.checkbox} ${styles.alwaysShowCheckbox}`}
            checked={Boolean(selected)}
            onChange={() => onToggleSelected?.()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
      </div>
      
      <div className={styles.info}>
        <h3 className={styles.title}>{item.title}</h3>
        {variant === "my" ? (
          <div className={styles.meta}>
            <span>{item.updatedAt ?? ""}</span>
            <span className={styles.action}>继续编辑 &rarr;</span>
          </div>
        ) : (
          <div className={styles.metaPublic}>
            <div className={styles.subtitle}>{item.subtitle ?? ""}</div>
          </div>
        )}
      </div>
    </div>
  )
}
