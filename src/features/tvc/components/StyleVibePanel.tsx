"use client"

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react"
import styles from "./StyleVibePanel.module.css"
import type { TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import { AgentImagePreviewModal, type AgentPreviewImage } from "./AgentImagePreviewModal"
import { TvcAssetMediaCard } from "./TvcAssetMediaCard"
import { extractAssetIndex } from "@/features/tvc/workspace/hooks/extractAssetIndex"
import { buildAssetMetaKey } from "@/features/tvc/workspace/hooks/assetMetaKey"
import { TvcScriptDocument } from "@/features/tvc/script/components/TvcScriptDocument"
import type { ClarificationUiState } from "@/features/tvc/clarification"
import { ClarificationPanel } from "@/features/tvc/clarification"
import { ImagePreviewModal } from "@/features/video/components/ImagePreviewModal"
import { WorkflowPhaseCard } from "./WorkflowPhaseCard"

const phases: Array<{ id: TvcPhaseId; label: string }> = [
  { id: "clarification", label: "需求澄清" },
  { id: "script", label: "剧情" },
  { id: "reference_image", label: "参考图" },
  { id: "storyboard", label: "分镜" },
  { id: "first_frame", label: "分镜首帧" },
  { id: "video_clip", label: "分镜视频" }
]

export function StyleVibePanel({
  projectId,
  activePhase,
  onPhaseChange,
  onOpenChat,
  onRequestSend: _onRequestSend,
  onRequestDraft: _onRequestDraft,
  onAssetDelete,
  durationSec,
  agentPhaseById,
  assetUrlByKey,
  userProvidedImages,
  clarification
}: {
  projectId: string
  activePhase: TvcPhaseId
  onPhaseChange: (id: TvcPhaseId) => void
  onOpenChat: () => void
  onRequestSend: (text: string, meta?: { kind?: "reference_image" | "first_frame" | "video_clip"; targetOrdinal?: number }) => void
  onRequestDraft: (text: string) => void
  onAssetDelete: (args: { kind: "reference_image" | "first_frame" | "video_clip"; ordinal: number }) => void
  durationSec: number
  agentPhaseById?: Partial<Record<TvcPhaseId, TvcAgentStep>>
  assetUrlByKey?: Record<string, string>
  userProvidedImages?: Array<{ ordinal: number; url: string; thumbnailUrl?: string }>
  clarification?: ClarificationUiState
}): ReactElement {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const sectionElsRef = useRef<Partial<Record<TvcPhaseId, HTMLElement | null>>>({})
  const [previewImage, setPreviewImage] = useState<AgentPreviewImage | null>(null)
  const [richPreview, setRichPreview] = useState<{
    title: string
    imageSrc: string
    typeLabel: string | null
    categoryRaw: string | null
    kind: "reference_image" | "first_frame"
    ordinal: number
    description: string | null
    prompt: string | null
    publicType: "character" | "background" | "props"
  } | null>(null)
  const [navCollapsed, setNavCollapsed] = useState(false)

  const closePreview = useCallback(() => setPreviewImage(null), [])
  const closeRichPreview = useCallback(() => setRichPreview(null), [])
  const showClarificationSection = Boolean(clarification?.text?.trim()) || (userProvidedImages?.length ?? 0) > 0

  const registerSection = useCallback((id: TvcPhaseId) => {
    return (el: HTMLElement | null) => {
      sectionElsRef.current[id] = el
    }
  }, [])

  const scrollTo = useCallback(
    (id: TvcPhaseId) => {
      const el = sectionElsRef.current[id]
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      onPhaseChange(id)
    },
    [onPhaseChange]
  )

  useEffect(() => {
    const root = canvasRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        visible.sort((a, b) => {
          const ratio = b.intersectionRatio - a.intersectionRatio
          if (ratio !== 0) return ratio
          return a.boundingClientRect.top - b.boundingClientRect.top
        })
        const top = visible[0]
        const id = (top.target as HTMLElement).dataset.phaseId as TvcPhaseId | undefined
        if (!id) return
        if (id !== activePhase) onPhaseChange(id)
      },
      { root, threshold: [0.2, 0.35, 0.5, 0.65], rootMargin: "-12% 0px -70% 0px" }
    )

    const visiblePhases = phases.filter((p) =>
      p.id === "clarification" ? showClarificationSection : Boolean(agentPhaseById?.[p.id])
    )
    for (const p of visiblePhases) {
      const el = sectionElsRef.current[p.id]
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [activePhase, onPhaseChange, agentPhaseById, showClarificationSection])

  const renderAgentStep = (phaseId: TvcPhaseId, step: TvcAgentStep): ReactElement => {
    const prompt = step.content.prompt?.trim() ?? ""
    const scriptMarkdown = String(step.content.scriptMarkdown ?? "")
    const sections = step.content.sections ?? []
    const images = step.content.images ?? []
    const storyboards = step.content.storyboards ?? []
    const videoClips = step.content.videoClips ?? []
    const stream = step.content.stream ?? {}
    const imageKind = phaseId === "reference_image" ? "reference_image" : phaseId === "first_frame" ? "first_frame" : ""

    const normalizeStoryboardKey = (key: string): string => {
      return String(key ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\u00A0\s]+/g, "")
        .replace(/[._-]+/g, "")
        .replace(/[：:]+$/g, "")
    }

    const pickStoryboardValue = (row: Record<string, string>, candidates: string[]): string => {
      const normalizedRow: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        const nk = normalizeStoryboardKey(k)
        const nv = String(v ?? "").trim()
        if (!nk || !nv) continue
        if (!(nk in normalizedRow)) normalizedRow[nk] = nv
      }
      for (const k of candidates) {
        const v = normalizedRow[normalizeStoryboardKey(k)] ?? ""
        if (v) return v
      }
      return ""
    }

    const toStoryboardItem = (row: Record<string, string>, idx: number) => {
      const scene = pickStoryboardValue(row, ["scene#", "scene", "scene_no", "scene_number", "场景", "场景号", "场景编号"]) || "1"
      const shot =
        pickStoryboardValue(row, ["shot#", "shot", "shot_number", "shotnumber", "镜头号", "镜头编号", "分镜号"]) || String(idx + 1)
      const duration = pickStoryboardValue(row, ["duration(s)", "duration", "duration_sec", "durationseconds", "时长", "秒"])
      const shotType = pickStoryboardValue(row, ["shot type", "shot_type", "shottype", "type", "镜头类型", "镜头"])
      const startFrame = pickStoryboardValue(row, ["start frame", "画面描述", "场景描述", "storyboard_text", "storyboardtext", "description", "画面", "描述"])
      const actionCamera = pickStoryboardValue(row, ["action & camera", "actioncamera", "动作描述", "action_description", "actiondescription", "action"])
      const endFrame = pickStoryboardValue(row, ["end frame", "endframe", "结束画面", "end_frame"])
      const voiceOver = pickStoryboardValue(row, ["voice over", "voiceover", "voice_over", "台词/旁白", "台词旁白", "台词", "旁白", "dialogue"])
      const reference = pickStoryboardValue(row, ["reference", "reference_image", "referenceimage", "参考图"])
      const captionBlocks: Array<{ label: string; text: string }> = []
      if (startFrame) captionBlocks.push({ label: "Start Frame", text: startFrame })
      if (actionCamera) captionBlocks.push({ label: "Action & Camera", text: actionCamera })
      if (endFrame) captionBlocks.push({ label: "End Frame", text: endFrame })
      if (voiceOver) captionBlocks.push({ label: "Voice Over", text: voiceOver })

      return { scene, shot, duration, shotType, captionBlocks, reference }
    }

    return (
      <div className={styles.agentWrap}>
        {prompt ? <div className={styles.agentPrompt}>{prompt}</div> : null}
        {phaseId === "script" && (scriptMarkdown || stream.scriptMarkdown) ? (
          <div className={styles.agentGroup}>
            {scriptMarkdown.trim() ? <TvcScriptDocument markdown={scriptMarkdown} /> : null}
            {stream.scriptMarkdown ? <div className={styles.agentStreaming}>生成中…</div> : null}
          </div>
        ) : null}

        {sections.length ? (
          <div className={styles.agentGroup}>
            {sections.map((s, idx) => (
              <div key={`${s.sectionName}_${idx}`} className={styles.agentSection}>
                <div className={styles.agentKvGrid}>
                  {s.fields.map((f, i) => (
                    <div key={`${f.name}_${i}`} className={styles.agentKvRow}>
                      <div className={styles.agentKvKey} title={f.name}>
                        {f.name}
                      </div>
                      <div className={styles.agentKvVal}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {stream.sections ? <div className={styles.agentStreaming}>段落生成中…</div> : null}
          </div>
        ) : stream.sections ? (
          <div className={styles.agentGroup}>
            <div className={styles.agentStreaming}>生成中…</div>
          </div>
        ) : null}

        {images.length || stream.images ? (
          <div className={styles.agentGroup}>
            {images.length ? (
              <div className={styles.agentImageGrid}>
                {images.map((img, idx) => {
                  const url = img.url ?? img.URL ?? img.href ?? ""
                  const desc = img.description ?? (img as any)["描述"] ?? img.prompt ?? img.PROMPT ?? ""
                  const name = (img as any).name ?? (img as any)["名称"] ?? ""
                  const category = img.category ?? (img as any)["分类"] ?? ""
                  const index = extractAssetIndex(img) ?? 0
                  const resolvedThumb = imageKind && index > 0 ? assetUrlByKey?.[`${imageKind}:${index}`] ?? "" : ""
                  const resolvedOrig = imageKind && index > 0 ? assetUrlByKey?.[`${imageKind}:${index}:orig`] ?? "" : ""
                  const metaResolvedThumb =
                    imageKind && !resolvedThumb && category && name ? assetUrlByKey?.[buildAssetMetaKey(imageKind, [category, name])] ?? "" : ""
                  const metaResolvedOrig =
                    imageKind && !resolvedOrig && category && name
                      ? assetUrlByKey?.[`${buildAssetMetaKey(imageKind, [category, name])}:orig`] ?? ""
                      : ""
                  const previewUrl = url || resolvedThumb || metaResolvedThumb || resolvedOrig || metaResolvedOrig
                  const openUrl = resolvedOrig || metaResolvedOrig || previewUrl
                  const categoryLabel =
                    category === "role" ? "角色" : category === "background" ? "背景" : category === "item" ? "物品" : (category || "参考图")
                  const displayName = name ? String(name) : desc ? String(desc) : `${categoryLabel} #${idx + 1}`
                  const title = `${categoryLabel}：${displayName}`
                  const publicType = category === "role" ? "character" : category === "item" ? "props" : "background"
                  const ordinal = index > 0 ? index : idx + 1
                  const openInfo = () => {
                    if (!openUrl) return
                    if (!imageKind || ordinal <= 0) return
                    setRichPreview({
                      title: displayName,
                      imageSrc: openUrl,
                      typeLabel: categoryLabel,
                      categoryRaw: category ? String(category) : null,
                      kind: imageKind as any,
                      ordinal,
                      description: desc ? String(desc) : null,
                      prompt: typeof img.prompt === "string" ? img.prompt : null,
                      publicType
                    })
                  }
                  return (
                    <TvcAssetMediaCard
                      key={`${openUrl || previewUrl || "img"}_${idx}`}
                      mediaType="image"
                      title={title}
                      typeLabel={categoryLabel}
                      name={displayName}
                      description={desc ? String(desc) : undefined}
                      url={openUrl}
                      thumbnailUrl={previewUrl}
                      statusTextWhenMissing="图片生成中…"
                      onOpen={openUrl && imageKind ? openInfo : undefined}
                      onViewInfo={openUrl && imageKind ? openInfo : undefined}
                      onDelete={
                        imageKind && ordinal > 0
                          ? () => {
                              onAssetDelete({ kind: imageKind as any, ordinal })
                            }
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <div className={styles.agentStreaming}>生成中…</div>
            )}
            {stream.images ? <div className={styles.agentStreaming}>图片生成中…</div> : null}
          </div>
        ) : null}

        {storyboards.length || stream.storyboards ? (
          <div className={styles.agentGroup}>
            {storyboards.length ? (
              <div className={styles.storyboardTable} role="table" aria-label="分镜表">
                <div className={styles.storyboardHeader} role="row">
                  <div className={`${styles.storyboardHeadCell} ${styles.storyboardHeadCellIndex} ${styles.storyboardHeadCellScene}`} role="columnheader">
                    Scene#
                  </div>
                  <div className={`${styles.storyboardHeadCell} ${styles.storyboardHeadCellIndex} ${styles.storyboardHeadCellShot}`} role="columnheader">
                    Shot#
                  </div>
                  <div className={`${styles.storyboardHeadCell} ${styles.storyboardHeadCellCaption}`} role="columnheader">
                    Caption
                  </div>
                  <div className={`${styles.storyboardHeadCell} ${styles.storyboardHeadCellMeta}`} role="columnheader">
                    Shot Type
                  </div>
                  <div className={`${styles.storyboardHeadCell} ${styles.storyboardHeadCellMeta}`} role="columnheader">
                    Duration(s)
                  </div>
                </div>
                <div className={styles.storyboardBody}>
                  {storyboards.map((row, idx) => {
                    const item = toStoryboardItem(row, idx)
                    return (
                      <div key={`sb_${item.scene}_${item.shot}_${idx}`} className={styles.storyboardRow} role="row">
                        <div className={`${styles.storyboardCellIndex} ${styles.storyboardCellScene}`} role="cell">
                          {item.scene}
                        </div>
                        <div className={`${styles.storyboardCellIndex} ${styles.storyboardCellShot}`} role="cell">
                          {item.shot}
                        </div>
                        <div className={styles.storyboardCellCaption} role="cell">
                          {item.captionBlocks.length ? (
                            <div className={styles.storyboardCaptionBlocks}>
                              {item.captionBlocks.map((b) => (
                                <div key={b.label} className={styles.storyboardCaptionBlock}>
                                  <div className={styles.storyboardCaptionLabel}>{b.label}</div>
                                  <div className={styles.storyboardCaptionText}>{b.text}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.storyboardCaptionEmpty}>—</div>
                          )}
                          <div className={styles.storyboardCaptionMeta} aria-hidden="true">
                            {item.shotType ? <span className={styles.storyboardChip}>{item.shotType}</span> : null}
                            {item.duration ? <span className={styles.storyboardChip}>{item.duration}s</span> : null}
                            {item.reference ? <span className={styles.storyboardChip}>ref: {item.reference}</span> : null}
                          </div>
                        </div>
                        <div className={styles.storyboardCellMeta} role="cell">
                          {item.shotType || "—"}
                        </div>
                        <div className={styles.storyboardCellMeta} role="cell">
                          {item.duration || "—"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.agentStreaming}>生成中…</div>
            )}
            {stream.storyboards ? <div className={styles.agentStreaming}>分镜生成中…</div> : null}
          </div>
        ) : null}

        {videoClips.length || stream.videoClips ? (
          <div className={styles.agentGroup}>
            {videoClips.length ? (
              <div className={styles.agentMediaGrid}>
                {videoClips.map((row, idx) => {
                  const index = extractAssetIndex(row) ?? Number((row as any).index ?? (row as any).ordinal ?? 0)
                  const ordinal = Number((row as any).ordinal ?? index ?? 0)
                  const resolvedThumb = index > 0 ? assetUrlByKey?.[`video_clip:${index}`] ?? "" : ""
                  const resolvedOrig = index > 0 ? assetUrlByKey?.[`video_clip:${index}:orig`] ?? "" : ""
                  const openUrl = resolvedOrig.trim()
                  const title = String((row as any).title ?? (row as any).description ?? "").trim() || (index > 0 ? `第${index}镜头视频片段` : `视频片段 ${idx + 1}`)

                  return (
                    <TvcAssetMediaCard
                      key={`vc_${index || idx}`}
                      mediaType="video"
                      title={title}
                      url={openUrl}
                      thumbnailUrl={resolvedThumb}
                      statusTextWhenMissing="视频片段生成中…"
                      onDelete={
                        index > 0
                          ? () => {
                              onAssetDelete({ kind: "video_clip", ordinal: index })
                            }
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <div className={styles.agentStreaming}>生成中…</div>
            )}
            {stream.videoClips ? <div className={styles.agentStreaming}>视频片段生成中…</div> : null}
          </div>
        ) : null}
      </div>
    )
  }

  const renderClarification = (): ReactElement => {
    return (
      <div className={styles.stepZeroWrap}>
        <ClarificationPanel clarification={clarification ?? null} variant="embedded" />
        {!clarification?.text?.trim() ? <div className={styles.stepZeroHint}>推荐流程：产品图（可选）→ 剧本 → 分镜 → 首帧 → 视频。</div> : null}
      </div>
    )
  }

  const renderSectionContent = (id: TvcPhaseId): ReactElement => {
    if (id === "clarification") return renderClarification()
    const agentStep = agentPhaseById?.[id]
    if (agentStep) return renderAgentStep(id, agentStep)

    return <></>
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>工作流</div>
        <div className={styles.badge}>Beta</div>
      </div>

      <div className={`${styles.layout} ${navCollapsed ? styles.layoutCollapsed : ""}`}>
        <aside className={`${styles.sidebar} ${navCollapsed ? styles.sidebarCollapsed : ""}`} aria-label="TVC 流程">
          <div className={styles.sidebarTop}>
            <div className={styles.sidebarTitle}>流程</div>
            <button
              type="button"
              className={styles.collapseBtn}
              aria-label={navCollapsed ? "展开流程栏" : "折叠流程栏"}
              aria-pressed={navCollapsed}
              title={navCollapsed ? "展开" : "折叠"}
              onClick={() => setNavCollapsed((v) => !v)}
            >
              {navCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav className={styles.nav}>
            {phases.map((s, idx) => {
              const isActive = s.id === activePhase
              const isAvailable = s.id === "clarification" ? showClarificationSection : Boolean(agentPhaseById?.[s.id])
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.step} ${isActive ? styles.stepActive : ""} ${isAvailable ? "" : styles.stepDisabled}`}
                  onClick={() => {
                    if (!isAvailable) return
                    scrollTo(s.id)
                  }}
                  disabled={!isAvailable}
                >
                  <span className={styles.stepLeft}>
                    <span className={`${styles.stepIndex} ${isActive ? styles.stepIndexActive : ""}`} aria-hidden="true">
                      {idx + 1}
                    </span>
                    <span className={styles.stepLabel}>{s.label}</span>
                  </span>
                  <span className={styles.stepChevron} aria-hidden="true">
                    ›
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className={styles.canvas} aria-label="画布" ref={canvasRef}>
          {phases
            .filter((s) => (s.id === "clarification" ? showClarificationSection : Boolean(agentPhaseById?.[s.id])))
            .map((s) => {
              const agentStep = agentPhaseById?.[s.id]
              const isStreaming = Boolean(agentStep?.content.stream && Object.values(agentStep.content.stream).some(Boolean))
              const status =
                s.id === "clarification"
                  ? clarification?.text?.trim()
                    ? clarification.done
                      ? "已完成"
                      : "收集中"
                    : null
                  : isStreaming
                    ? "生成中"
                    : "已生成"

              return (
                <section key={s.id} className={styles.section} data-phase-id={s.id} ref={registerSection(s.id)}>
                  <WorkflowPhaseCard title={s.label} status={status}>
                    {s.id === "clarification" && (userProvidedImages?.length ?? 0) > 0 ? (
                      <div className={styles.userImageBar} aria-label="用户提供的图片">
                        <div className={styles.userImageGrid}>
                          {userProvidedImages!
                            .slice()
                            .sort((a, b) => a.ordinal - b.ordinal)
                            .map((img) => {
                              const thumb = String(img.thumbnailUrl ?? img.url ?? "").trim()
                              const openUrl = String(img.url ?? "").trim()
                              const alt = `用户图片 ${img.ordinal}`
                              const onOpen = () => {
                                if (!openUrl) return
                                setPreviewImage({ url: openUrl, alt, description: "用户提供的产品图" })
                              }
                              return (
                                <div
                                  key={`user_${img.ordinal}_${openUrl}`}
                                  className={`${styles.agentImageCard} ${openUrl ? styles.agentImageCardClickable : ""}`}
                                  role={openUrl ? "button" : undefined}
                                  tabIndex={openUrl ? 0 : -1}
                                  onClick={openUrl ? onOpen : undefined}
                                  onKeyDown={
                                    openUrl
                                      ? (e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            onOpen()
                                          }
                                        }
                                      : undefined
                                  }
                                  aria-label={openUrl ? `预览用户图片：${alt}` : undefined}
                                >
                                  <div className={styles.agentImageThumbWrap}>
                                    {thumb ? <img className={styles.agentImageThumb} src={thumb} alt={alt} /> : <div className={styles.agentImageThumbFallback} />}
                                  </div>
                                  <div className={styles.agentImageMeta}>
                                    <div className={styles.agentImageLine}>用户图片 #{img.ordinal}</div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    ) : null}
                    {renderSectionContent(s.id)}
                  </WorkflowPhaseCard>
                </section>
              )
            })}
        </div>
      </div>
      <AgentImagePreviewModal open={Boolean(previewImage)} image={previewImage} onClose={closePreview} />
      <ImagePreviewModal
        open={Boolean(richPreview)}
        title={richPreview?.title ?? ""}
        imageSrc={richPreview?.imageSrc ?? ""}
        storyId={projectId}
        category={richPreview?.categoryRaw ?? null}
        tvcAsset={richPreview ? { kind: richPreview.kind, ordinal: richPreview.ordinal } : null}
        description={richPreview?.description ?? null}
        prompt={richPreview?.prompt ?? null}
        onClose={closeRichPreview}
      />
    </div>
  )
}
