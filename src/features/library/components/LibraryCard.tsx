import type { ReactElement } from "react"
import { Pencil, Film, FileText, Image as ImageIcon, Eye, Music } from "lucide-react"
import Image from "next/image"
import styles from "./LibraryCard.module.css"
import type { StoryMetadata } from "@/features/video/types/story"

export interface LibraryItem {
  id: string
  title: string
  type: "draft" | "video" | "storyboard" | "material"
  updatedAt?: string
  subtitle?: string
  thumbnail?: string
  originalUrl?: string
  specs?: string // e.g. "4:3 480p"
  scope?: "my" | "public"
  publicCategory?: string
  metadata?: StoryMetadata
  progressStage?: string
}

interface LibraryCardProps {
  item: LibraryItem
  view: "grid" | "list"
  onClick?: () => void
  selected?: boolean
  onToggleSelected?: () => void
  onViewOriginal?: () => void
}

export function LibraryCard({ item, view, onClick, selected, onToggleSelected, onViewOriginal }: LibraryCardProps): ReactElement {
  const variant = item.scope ?? "my"
  const isList = view === "list"

  const previewUrl = item.thumbnail
  const previewKind = (() => {
    if (!previewUrl) return "none"
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
  
  const TypeIcon = {
    draft: Pencil,
    video: Film,
    storyboard: FileText,
    material: ImageIcon,
  }[item.type]


  const stageLabel =
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

  // 计算进度显示
  const progress = item.metadata?.progress
  const showProgress = progress && (progress.shotTotal ?? 0) > 0
  const progressPercent = showProgress 
    ? Math.round(((progress?.shotScriptDone ?? 0) / (progress?.shotTotal ?? 1)) * 100)
    : 0

  return (
    <div 
      className={`${styles.card} ${isList ? styles.cardList : ""}`} 
      onClick={onClick}
    >
      <div className={styles.preview}>
        {previewUrl && previewKind === "image" ? (
          <Image src={previewUrl} alt={item.title} className={styles.previewImage} fill sizes={isList ? "160px" : "320px"} />
        ) : previewUrl && previewKind === "video" ? (
          <div className={styles.placeholder}>
            <Film size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        ) : previewUrl && previewKind === "audio" ? (
          <div className={styles.placeholder}>
            <Music size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <TypeIcon size={isList ? 24 : 32} strokeWidth={1.5} />
          </div>
        )}

        {variant === "my" && item.type === "storyboard" && onViewOriginal ? (
          <button
            type="button"
            className={`${styles.viewOriginalBtn} ${item.specs ? styles.viewOriginalBtnShift : ""}`}
            onClick={(e) => {
              e.stopPropagation()
              onViewOriginal()
            }}
          >
            <Eye size={14} strokeWidth={2} />
            查看原始内容
          </button>
        ) : null}
        
        {variant === "my" ? (
          <>
            <div className={styles.typeTag} title={`progressStage: ${item.progressStage ?? ""}`}>
              <TypeIcon size={12} strokeWidth={2} />
              <span className={styles.typeTagText}>
                {stageLabel ? `阶段：${stageLabel}` : ""}
              </span>
            </div>
            {item.specs ? <div className={styles.specTag}>{item.specs}</div> : null}
            {item.type === "storyboard" ? (
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

        {variant === "public" ? (
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
            {showProgress ? (
              <div className={styles.progressBarWrapper} title={`脚本进度: ${progress?.shotScriptDone}/${progress?.shotTotal}`}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                </div>
                <span className={styles.progressText}>{progressPercent}%</span>
              </div>
            ) : (
              <span>{item.updatedAt ?? ""}</span>
            )}
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
