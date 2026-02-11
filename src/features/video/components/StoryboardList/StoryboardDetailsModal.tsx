import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { createPortal } from "react-dom"
import type { StoryboardItem } from "../../types"
import styles from "./StoryboardDetailsModal.module.css"
import { createPreviewSvgDataUrl } from "../../utils/svgUtils"
import { extractReferenceImagePrompts } from "../../utils/referenceImagePrompts"
import { StoryboardAssetRow, type StoryboardAssetRowItem } from "./StoryboardAssetRow"

type PreviewRow = { id: string; name: string; url: string; thumbnailUrl?: string | null; category?: string; storyboardId?: string | null; isGlobal?: boolean; description?: string | null; prompt?: string | null }

type StoryboardDetailsModalProps = {
  open: boolean
  item: StoryboardItem
  previews?: { role: PreviewRow[]; background: PreviewRow[]; item: PreviewRow[] }
  onClose: () => void
  onPreviewImage: (
    title: string,
    imageSrc: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => void
  onSaveEdits: (params: {
    itemId: string
    storyboardText: string
    firstPrompt: string
    lastPrompt: string
    videoPrompt: string
    regenerateAfterSave: boolean
  }) => Promise<void> | void
}

function isPlaceholderId(id: string): boolean {
  return id.startsWith("placeholder:")
}

export function StoryboardDetailsModal({ open, item, previews, onClose, onPreviewImage, onSaveEdits }: StoryboardDetailsModalProps): ReactElement | null {
  const canPortal = typeof document !== "undefined"
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef<{ storyboardText: string; firstPrompt: string; lastPrompt: string; videoPrompt: string } | null>(null)
  const storyboardTextRef = useRef<HTMLDivElement | null>(null)
  const firstPromptRef = useRef<HTMLPreElement | null>(null)
  const lastPromptRef = useRef<HTMLPreElement | null>(null)
  const videoPromptRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  const title = useMemo(() => `镜头 ${item.scene_no} · 分镜详情`, [item.scene_no])

  const resetEditableContent = useCallback(() => {
    const nextBaseline = {
      storyboardText: (item.storyboard_text ?? "").trim(),
      firstPrompt: (item.frames?.first?.prompt ?? "").trim(),
      lastPrompt: (item.frames?.last?.prompt ?? "").trim(),
      videoPrompt: (item.videoInfo?.prompt ?? "").trim()
    }
    baselineRef.current = nextBaseline
    if (storyboardTextRef.current) storyboardTextRef.current.textContent = nextBaseline.storyboardText
    if (firstPromptRef.current) firstPromptRef.current.textContent = nextBaseline.firstPrompt
    if (lastPromptRef.current) lastPromptRef.current.textContent = nextBaseline.lastPrompt
    if (videoPromptRef.current) videoPromptRef.current.textContent = nextBaseline.videoPrompt
    setDirty(false)
    setSaveError(null)
  }, [item.frames, item.storyboard_text, item.videoInfo, setDirty])

  useEffect(() => {
    if (!open) return
    resetEditableContent()
  }, [item.id, open, resetEditableContent])

  const computeDisplayList = useMemo(() => {
    const extracted = extractReferenceImagePrompts(item.scriptContent)
    const isNarrator = (name: string) => {
      const n = name.trim()
      if (!n) return false
      return n === "旁白" || n.toLowerCase() === "narrator"
    }

    const buildExpected = (kind: "role" | "background" | "item", label: string) => {
      const promptEntities = extracted
        .filter((p) => p.category === kind)
        .map((p) => ({
          name: (p.name ?? "").trim(),
          prompt: (p.prompt ?? "").trim(),
          description: ((p.description ?? "").trim() || (p.prompt ?? "").trim() || "").trim()
        }))
        .filter((p) => p.name)

      if (promptEntities.length > 0) return promptEntities

      if (kind === "background") {
        const name = (item.shot_content?.background?.background_name ?? "").trim()
        return name ? [{ name, prompt: "", description: "" }] : []
      }

      if (kind === "role") {
        const roles = Array.isArray(item.shot_content?.roles) ? item.shot_content.roles : []
        const names = roles
          .map((r) => (r && typeof r.role_name === "string" ? r.role_name.trim() : ""))
          .filter((n) => n && !isNarrator(n))
        const seen = new Set<string>()
        return names
          .filter((n) => {
            if (seen.has(n)) return false
            seen.add(n)
            return true
          })
          .map((name) => ({ name, prompt: "", description: "" }))
      }

      const roleItems = Array.isArray(item.shot_content?.role_items) ? item.shot_content.role_items : []
      const otherItems = Array.isArray(item.shot_content?.other_items) ? item.shot_content.other_items : []
      const names = [...roleItems, ...otherItems].map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean)
      const seen = new Set<string>()
      return names
        .filter((n) => {
          if (seen.has(n)) return false
          seen.add(n)
          return true
        })
        .map((name) => ({ name, prompt: "", description: "" }))
    }

    const buildDisplay = (kind: "role" | "background" | "item", label: string, list: PreviewRow[]) => {
      const expected = buildExpected(kind, label)
      const existingNames = new Set(list.map((img) => (img.name ?? "").trim()).filter(Boolean))
      const placeholders: PreviewRow[] = expected
        .filter((e) => e.name && !existingNames.has(e.name))
        .map((e) => {
          const placeholderSrc = createPreviewSvgDataUrl(e.name, `镜头 ${item.scene_no} · ${label} · 未生成`)
          return {
            id: `placeholder:${kind}:${item.id}:${e.name}`,
            name: e.name,
            url: placeholderSrc,
            thumbnailUrl: placeholderSrc,
            category: kind,
            storyboardId: item.id,
            isGlobal: false,
            description: e.description || null,
            prompt: e.prompt || null
          }
        })
      return [...list, ...placeholders]
    }

    return {
      role: buildDisplay("role", "角色", previews?.role ?? []),
      background: buildDisplay("background", "背景", previews?.background ?? []),
      item: buildDisplay("item", "物品", previews?.item ?? [])
    }
  }, [item.id, item.scene_no, item.scriptContent, item.shot_content, previews])

  const updateDirty = useCallback(() => {
    const baseline = baselineRef.current
    if (!baseline) return
    const storyboardText = (storyboardTextRef.current?.innerText ?? "").trim()
    const firstPrompt = (firstPromptRef.current?.innerText ?? "").trim()
    const lastPrompt = (lastPromptRef.current?.innerText ?? "").trim()
    const videoPrompt = (videoPromptRef.current?.innerText ?? "").trim()
    setDirty(
      storyboardText !== baseline.storyboardText ||
        firstPrompt !== baseline.firstPrompt ||
        lastPrompt !== baseline.lastPrompt ||
        videoPrompt !== baseline.videoPrompt
    )
  }, [])

  const handleSaveAll = useCallback(async () => {
    if (saving) return
    const baseline = baselineRef.current
    if (!baseline) return
    const storyboardText = (storyboardTextRef.current?.innerText ?? "").trim()
    const firstPrompt = (firstPromptRef.current?.innerText ?? "").trim()
    const lastPrompt = (lastPromptRef.current?.innerText ?? "").trim()
    const videoPrompt = (videoPromptRef.current?.innerText ?? "").trim()
    const regenerateAfterSave =
      storyboardText !== baseline.storyboardText &&
      firstPrompt === baseline.firstPrompt &&
      lastPrompt === baseline.lastPrompt &&
      videoPrompt === baseline.videoPrompt

    setSaving(true)
    setSaveError(null)
    try {
      await onSaveEdits({ itemId: item.id, storyboardText, firstPrompt, lastPrompt, videoPrompt, regenerateAfterSave })
      baselineRef.current = { storyboardText, firstPrompt, lastPrompt, videoPrompt }
      setDirty(false)
    } catch (e) {
      const anyErr = e as { message?: string }
      setSaveError(anyErr?.message ?? "保存失败")
    } finally {
      setSaving(false)
    }
  }, [item.id, onSaveEdits, saving])

  const frameItems = useMemo((): StoryboardAssetRowItem[] => {
    const out: StoryboardAssetRowItem[] = []
    const firstThumb = (item.frames?.first?.thumbnailUrl ?? "").trim()
    const firstUrl = (item.frames?.first?.url ?? "").trim()
    const firstDisplaySrc = firstThumb || firstUrl
    const firstPreviewSrc = firstUrl || firstThumb
    if (firstDisplaySrc) {
      out.push({
        id: `frame:first:${item.id}`,
        name: "首帧",
        url: firstPreviewSrc,
        thumbnailUrl: firstThumb || null,
        storyboardId: item.id,
        prompt: item.frames?.first?.prompt ?? null,
        tag: "首"
      })
    }

    const lastThumb = (item.frames?.last?.thumbnailUrl ?? "").trim()
    const lastUrl = (item.frames?.last?.url ?? "").trim()
    const lastDisplaySrc = lastThumb || lastUrl
    const lastPreviewSrc = lastUrl || lastThumb
    if (lastDisplaySrc) {
      out.push({
        id: `frame:last:${item.id}`,
        name: "尾帧",
        url: lastPreviewSrc,
        thumbnailUrl: lastThumb || null,
        storyboardId: item.id,
        prompt: item.frames?.last?.prompt ?? null,
        tag: "尾"
      })
    }
    return out
  }, [item.frames, item.id])

  if (!open) return null

  const content = (
    <div className={styles.overlay} role="presentation" onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>{title}</div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.headerBtn} onClick={() => void handleSaveAll()} disabled={!dirty || saving}>
              {saving ? "保存中…" : "保存"}
            </button>
            <button type="button" className={styles.closeBtn} onClick={() => onClose()} aria-label="关闭">
              ×
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.layout}>
            <div className={styles.leftCol}>
              <section className={styles.section} aria-label="分镜描述">
                <div className={styles.sectionTitle}>分镜描述</div>
                <div className={styles.textBlockEditableWrap}>
                  <div
                    ref={storyboardTextRef}
                    className={styles.textBlockEditable}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="分镜描述"
                    data-placeholder="在这里编辑分镜描述…"
                    onInput={updateDirty}
                  />
                </div>
              </section>

              <section className={styles.section} aria-label="提示词">
                <div className={styles.sectionTitle}>提示词</div>
                <div className={styles.promptStack}>
                  <div className={styles.promptCard} aria-label="首帧图提示词">
                    <div className={styles.promptCardHeader}>
                      <div className={styles.promptCardTitle}>首帧图提示词</div>
                    </div>
                    <pre
                      ref={firstPromptRef}
                      className={styles.promptBodyEditable}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="首帧图提示词"
                      data-placeholder="在这里编辑首帧图提示词…"
                      onInput={updateDirty}
                    />
                  </div>
                  <div className={styles.promptCard} aria-label="尾帧图提示词">
                    <div className={styles.promptCardHeader}>
                      <div className={styles.promptCardTitle}>尾帧图提示词</div>
                    </div>
                    <pre
                      ref={lastPromptRef}
                      className={styles.promptBodyEditable}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="尾帧图提示词"
                      data-placeholder="在这里编辑尾帧图提示词…"
                      onInput={updateDirty}
                    />
                  </div>
                  <div className={styles.promptCard} aria-label="视频提示词">
                    <div className={styles.promptCardHeader}>
                      <div className={styles.promptCardTitle}>视频提示词</div>
                    </div>
                    <pre
                      ref={videoPromptRef}
                      className={styles.promptBodyEditable}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="视频提示词"
                      data-placeholder="在这里编辑视频提示词…"
                      onInput={updateDirty}
                    />
                  </div>
                </div>
              </section>
              {saveError ? (
                <div className={styles.saveError} role="status">
                  {saveError}
                </div>
              ) : null}
            </div>

            <div className={styles.rightCol}>
              <section className={styles.section} aria-label="素材">
                <div className={styles.sectionTitle}>素材</div>
                <div className={styles.assetStack}>
                  {frameItems.length > 0 ? (
                    <StoryboardAssetRow
                      title="首尾帧图片"
                      items={frameItems}
                      isPlaceholderId={isPlaceholderId}
                      onClickItem={(img) =>
                        onPreviewImage(
                          `镜头 ${item.scene_no} · ${img.name}`,
                          img.url,
                          undefined,
                          item.id,
                          null,
                          null,
                          img.prompt ?? null
                        )
                      }
                    />
                  ) : null}
                  <StoryboardAssetRow
                    title="角色图"
                    items={computeDisplayList.role}
                    isPlaceholderId={isPlaceholderId}
                    onClickItem={(img) =>
                      onPreviewImage(
                        img.name,
                        img.url,
                        isPlaceholderId(img.id) ? undefined : img.id,
                        img.storyboardId ?? item.id,
                        img.category ?? "role",
                        img.description,
                        img.prompt
                      )
                    }
                  />
                  <StoryboardAssetRow
                    title="背景图"
                    items={computeDisplayList.background}
                    isPlaceholderId={isPlaceholderId}
                    onClickItem={(img) =>
                      onPreviewImage(
                        img.name,
                        img.url,
                        isPlaceholderId(img.id) ? undefined : img.id,
                        img.storyboardId ?? item.id,
                        img.category ?? "background",
                        img.description,
                        img.prompt
                      )
                    }
                  />
                  <StoryboardAssetRow
                    title="物品图"
                    items={computeDisplayList.item}
                    isPlaceholderId={isPlaceholderId}
                    onClickItem={(img) =>
                      onPreviewImage(
                        img.name,
                        img.url,
                        isPlaceholderId(img.id) ? undefined : img.id,
                        img.storyboardId ?? item.id,
                        img.category ?? "item",
                        img.description,
                        img.prompt
                      )
                    }
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return canPortal ? createPortal(content, document.body) : content
}
