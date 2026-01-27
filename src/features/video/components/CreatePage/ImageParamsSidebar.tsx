import { type ReactElement, useState } from "react"
import styles from "./ImageParamsSidebar.module.css"
import { ChipWithThumb } from "./ImageParamsSidebarParts/ChipWithThumb"
import { ChipGroup } from "./ImageParamsSidebarParts/ChipGroup"
import { LastFrameModal } from "./ImageParamsSidebarParts/LastFrameModal"

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
  onGenerate: (opts?: { mode?: "both" | "tailOnly" }) => void
  onPickReferenceImage?: (p: { category: "background" | "role" | "item"; name: string }) => void
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
  onPickReferenceImage,
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
  const [firstFrameLocked, setFirstFrameLocked] = useState(false)

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

      {firstFrameLocked ? (
        <div className={styles.firstFrameLockedRow} aria-label="首帧已锁定">
          <div className={styles.firstFrameLockedText}>首帧已使用上个分镜尾帧</div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              setFirstFrameLocked(false)
              setActivePromptTab("first")
            }}
          >
            恢复提示词
          </button>
        </div>
      ) : null}

      <div className={`${styles.promptStack} ${firstFrameLocked ? styles.promptStackSingle : ""}`} aria-label="首帧与尾帧提示词">
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

        {!firstFrameLocked ? (
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
        ) : null}
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
            onPick={() => {
              onPickReferenceImage?.({ category: "background", name: sceneText })
            }}
          />
        ) : null}
      </ChipGroup>

      <ChipGroup title="出场角色">
        {roles.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
        {roles.map((name) => {
          const p = pickPreview(rolePreviews, name)
          const thumbUrl = p?.thumbnailUrl ?? p?.url
          return (
            <ChipWithThumb
              key={`role-${name}`}
              label={name}
              thumbUrl={thumbUrl}
              onPreview={() => {
                if (!p?.url) return
                onPreviewImage?.(name, p.url, p.id, p.storyboardId ?? null, p.category ?? null, p.description, p.prompt)
              }}
              onPick={() => {
                onPickReferenceImage?.({ category: "role", name })
              }}
            />
          )
        })}
      </ChipGroup>

      <ChipGroup title="物品">
        {items.length === 0 ? <span className={`${styles.chip} ${styles.chipMuted}`}>未选择</span> : null}
        {items.map((name) => {
          const p = pickPreview(itemPreviews, name)
          const thumbUrl = p?.thumbnailUrl ?? p?.url
          return (
            <ChipWithThumb
              key={`item-${name}`}
              label={name}
              thumbUrl={thumbUrl}
              onPreview={() => {
                if (!p?.url) return
                onPreviewImage?.(name, p.url, p.id, p.storyboardId ?? null, p.category ?? null, p.description, p.prompt)
              }}
              onPick={() => {
                onPickReferenceImage?.({ category: "item", name })
              }}
            />
          )
        })}
      </ChipGroup>

      <button
        type="button"
        className={styles.primaryBtn}
        onClick={() => {
          onGenerate({ mode: firstFrameLocked ? "tailOnly" : "both" })
        }}
        disabled={Boolean(isGenerating)}
      >
        {isGenerating ? "合成中…" : firstFrameLocked ? "生成尾帧" : "生成图片"}
      </button>

      <LastFrameModal
        open={lastFrameModalOpen}
        prevVideoLastFrameUrl={prevVideoLastFrameUrl}
        errorText={shotCutError}
        usingLastFrame={usingLastFrame}
        onClose={() => setLastFrameModalOpen(false)}
        onUse={async () => {
          setShotCutError(null)
          if (!prevVideoLastFrameUrl) {
            setShotCutError("未在数据库中找到上个分镜视频的尾帧图")
            setLastFrameModalOpen(false)
            return
          }
          try {
            setUsingLastFrame(true)
            await onUsePrevVideoLastFrame?.(prevVideoLastFrameUrl)
            setFirstFrameLocked(true)
            setActivePromptTab("last")
            setLastFrameModalOpen(false)
          } catch (e) {
            const anyErr = e as { message?: string }
            setShotCutError(anyErr?.message ?? "使用尾帧图失败")
            setLastFrameModalOpen(false)
          } finally {
            setUsingLastFrame(false)
          }
        }}
      />
    </aside>
  )
}
