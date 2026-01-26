import Image from "next/image"
import { type ReactElement, type ReactNode, useState } from "react"
import styles from "./ImageParamsSidebar.module.css"

type PreviewImage = {
  id: string
  name: string
  url: string
  thumbnailUrl?: string | null
  category?: string
  storyboardId?: string | null
  description?: string | null
  prompt?: string | null
}

type Props = {
  prompt: string
  setPrompt: (v: string) => void
  tailPrompt: string
  setTailPrompt: (v: string) => void
  isGenerating?: boolean
  recommendedStoryboardMode?: "首帧" | "首尾帧" | null
  shotCut?: boolean
  prevVideoLastFrameUrl?: string | null
  onUsePrevVideoLastFrame?: (url: string) => Promise<void> | void
  sceneText: string
  setSceneText: (v: string) => void
  roles: string[]
  setRoles: (v: React.SetStateAction<string[]>) => void
  items: string[]
  setItems: (v: React.SetStateAction<string[]>) => void
  onGenerate: () => void
  onPreviewImage?: (
    title: string,
    imageSrc: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => void
  previews?: {
    role: PreviewImage[]
    background: PreviewImage[]
    item: PreviewImage[]
  }
}

function pickPreview(list: PreviewImage[], name: string): PreviewImage | null {
  const key = name.trim()
  if (!key) return null
  const exact = list.find((p) => p.name === key)
  if (exact) return exact
  const include = list.find((p) => key.includes(p.name) || p.name.includes(key))
  if (include) return include
  if (list.length === 1) return list[0]
  return null
}

function ChipWithThumb({
  label,
  thumbUrl,
  onPreview
}: {
  label: string
  thumbUrl?: string | null
  onPreview?: () => void
}): ReactElement {
  const displayLabel = label.length > 3 ? `${label.slice(0, 3)}...` : label
  return (
    <span
      className={styles.chip}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (!onPreview) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPreview()
        }
      }}
      role={onPreview ? "button" : undefined}
      tabIndex={onPreview ? 0 : undefined}
    >
      <span className={styles.chipThumb} aria-hidden="true">
        {thumbUrl ? (
          <Image className={styles.chipThumbImg} src={thumbUrl} alt="" width={22} height={22} unoptimized />
        ) : (
          <span className={styles.chipThumbFallback} />
        )}
      </span>
      <span className={styles.chipText} title={label}>
        {displayLabel}
      </span>
    </span>
  )
}

function ChipGroup({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <span>{title}</span>
      </div>
      <div className={styles.chipList}>{children}</div>
    </div>
  )
}

export function ImageParamsSidebar({
  prompt, setPrompt,
  tailPrompt, setTailPrompt,
  recommendedStoryboardMode,
  shotCut,
  prevVideoLastFrameUrl,
  onUsePrevVideoLastFrame,
  sceneText, setSceneText,
  roles, setRoles,
  items, setItems,
  onGenerate,
  onPreviewImage,
  previews,
  isGenerating
}: Props): ReactElement {
  const rolePreviews = previews?.role ?? []
  const bgPreviews = previews?.background ?? []
  const itemPreviews = previews?.item ?? []
  const [activePromptTab, setActivePromptTab] = useState<"first" | "last">("first")
  const [lastFrameModalOpen, setLastFrameModalOpen] = useState(false)
  const [shotCutError, setShotCutError] = useState<string | null>(null)
  const [usingLastFrame, setUsingLastFrame] = useState(false)

  return (
    <aside className={styles.left} aria-label="生图参数区">
      <div className={styles.titleRow}>
        {shotCut ? (
          <div className={styles.shotCutRow}>
            <span className={styles.shotCutHint}>推荐使用上个分镜的尾帧</span>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setShotCutError(null)
                if (!prevVideoLastFrameUrl) {
                  setShotCutError("未在数据库中找到上个分镜视频的尾帧图")
                  return
                }
                setLastFrameModalOpen(true)
              }}
            >
              查看尾帧图
            </button>
          </div>
        ) : null}
      </div>
      {shotCutError ? <div className={styles.shotCutError}>{shotCutError}</div> : null}

      <div className={styles.promptStack} aria-label="首帧与尾帧提示词">
        <div
          className={`${styles.promptCard} ${activePromptTab === "last" ? styles.promptCardFront : styles.promptCardBack}`}
          role={activePromptTab === "last" ? undefined : "button"}
          tabIndex={activePromptTab === "last" ? undefined : 0}
          onClick={activePromptTab === "last" ? undefined : () => setActivePromptTab("last")}
          onKeyDown={
            activePromptTab === "last"
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setActivePromptTab("last")
                  }
                }
          }
        >
          <div className={styles.labelRow}>
            <span>尾帧提示词</span>
            <span className={styles.counter}>{tailPrompt.length}/1000</span>
          </div>
          {activePromptTab === "last" ? (
            <textarea
              className={styles.textarea}
              value={tailPrompt}
              onChange={(e) => setTailPrompt(e.target.value.slice(0, 1000))}
              maxLength={1000}
            />
          ) : (
            <div className={styles.promptPlaceholder} aria-hidden="true" />
          )}
        </div>

        <div
          className={`${styles.promptCard} ${activePromptTab === "first" ? styles.promptCardFront : styles.promptCardBack}`}
          role={activePromptTab === "first" ? undefined : "button"}
          tabIndex={activePromptTab === "first" ? undefined : 0}
          onClick={
            activePromptTab === "first"
              ? undefined
              : () => {
                  setActivePromptTab("first")
                }
          }
          onKeyDown={
            activePromptTab === "first"
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setActivePromptTab("first")
                  }
                }
          }
        >
          <div className={styles.labelRow}>
            <span>首帧提示词</span>
            <span className={styles.counter}>{prompt.length}/1000</span>
          </div>
          {activePromptTab === "first" ? (
            <textarea
              className={styles.textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
              maxLength={1000}
            />
          ) : (
            <div className={styles.promptPlaceholder} aria-hidden="true" />
          )}
        </div>
      </div>

      <ChipGroup title="背景">
        {!sceneText ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
        {sceneText ? (
          <ChipWithThumb
            label={sceneText}
            thumbUrl={(pickPreview(bgPreviews, sceneText)?.thumbnailUrl ?? pickPreview(bgPreviews, sceneText)?.url) || bgPreviews[0]?.thumbnailUrl || bgPreviews[0]?.url}
            onPreview={() => {
              const p = pickPreview(bgPreviews, sceneText) ?? bgPreviews[0] ?? null
              if (!p?.url) return
              onPreviewImage?.(p.name, p.url, p.id, p.storyboardId ?? null, p.category ?? null, p.description, p.prompt)
            }}
          />
        ) : (
          <span className={styles.chip}>{sceneText}</span>
        )}
      </ChipGroup>

      <ChipGroup title="出场角色">
        {roles.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
        {roles.map((name) => {
          const p = pickPreview(rolePreviews, name)
          const thumbUrl = p?.thumbnailUrl ?? p?.url
          return (
            <span key={`role-${name}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ChipWithThumb
              label={name}
              thumbUrl={thumbUrl}
              onPreview={() => {
                if (!p?.url) return
                onPreviewImage?.(name, p.url, p.id, p.storyboardId ?? null, p.category ?? null, p.description, p.prompt)
              }}
            />
            </span>
          )
        })}
      </ChipGroup>

      <ChipGroup title="物品">
        {items.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
        {items.map((name) => {
          const p = pickPreview(itemPreviews, name)
          const thumbUrl = p?.thumbnailUrl ?? p?.url
          return (
            <span key={`item-${name}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ChipWithThumb
              label={name}
              thumbUrl={thumbUrl}
              onPreview={() => {
                if (!p?.url) return
                onPreviewImage?.(name, p.url, p.id, p.storyboardId ?? null, p.category ?? null, p.description, p.prompt)
              }}
            />
            </span>
          )
        })}
      </ChipGroup>

      <button type="button" className={styles.primaryBtn} onClick={onGenerate} disabled={Boolean(isGenerating)}>
        {isGenerating ? "合成中…" : "生成图片"}
      </button>

      {lastFrameModalOpen ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="查看尾帧图"
          onClick={() => setLastFrameModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>上个分镜视频尾帧图</div>
              <button type="button" className={styles.secondaryBtn} onClick={() => setLastFrameModalOpen(false)}>
                关闭
              </button>
            </div>
            <div className={styles.modalBody}>
              {prevVideoLastFrameUrl ? (
                <div className={styles.modalImgWrap}>
                  <Image className={styles.modalImg} src={prevVideoLastFrameUrl} alt="" width={1200} height={900} unoptimized />
                </div>
              ) : (
                <div className={styles.shotCutError}>未在数据库中找到上个分镜视频的尾帧图</div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setLastFrameModalOpen(false)}
                disabled={usingLastFrame}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                disabled={usingLastFrame || !prevVideoLastFrameUrl}
                onClick={async () => {
                  setShotCutError(null)
                  if (!prevVideoLastFrameUrl) {
                    setShotCutError("未在数据库中找到上个分镜视频的尾帧图")
                    setLastFrameModalOpen(false)
                    return
                  }
                  try {
                    setUsingLastFrame(true)
                    await onUsePrevVideoLastFrame?.(prevVideoLastFrameUrl)
                    setLastFrameModalOpen(false)
                  } catch (e) {
                    const anyErr = e as { message?: string }
                    setShotCutError(anyErr?.message ?? "使用尾帧图失败")
                    setLastFrameModalOpen(false)
                  } finally {
                    setUsingLastFrame(false)
                  }
                }}
              >
                使用
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
