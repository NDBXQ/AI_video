import { type ReactElement, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { StoryboardItem } from "../../types"
import { ChipEditModal } from "../ChipEditModal"
import { ImagePreviewModal } from "../ImagePreviewModal"
import { StoryboardTextModal } from "../StoryboardTextModal"
import styles from "./index.module.css"
import { useStoryboardData } from "../../hooks/useStoryboardData"
import { useStoryboardActions } from "../../hooks/useStoryboardActions"
import { useScriptGeneration, type ScriptGenerateState } from "../../hooks/useScriptGeneration"
import { createPreviewSvgDataUrl } from "../../utils/svgUtils"
import { useStoryboardPreviews } from "../../hooks/useStoryboardPreviews"
import { useAutoGenerateStoryboards } from "../../hooks/useAutoGenerateStoryboards"
import { fetchStoryboards, generateStoryboardPrompts } from "../../api/generation"
import { extractReferenceImagePrompts } from "../../utils/referenceImagePrompts"
import { startReferenceImageJob, waitReferenceImageJob } from "../../utils/referenceImageAsync"
import { StoryboardSidebar } from "./StoryboardSidebar"
import { StoryboardToolbar } from "./StoryboardToolbar"
import { StoryboardTable } from "./StoryboardTable"
import { GenerationPanel } from "./GenerationPanel"
import { StoryboardDetailsModal } from "./StoryboardDetailsModal"
import { useEpisodeRegeneration } from "./hooks/useEpisodeRegeneration"
import { useGenerationPanelModel } from "./hooks/useGenerationPanelModel"
import type { OpenStoryboardTextEditParams, StoryboardTextEditKind } from "./textEditTypes"
import { ConfirmModal } from "@/shared/ui/ConfirmModal"

type StoryboardListProps = {
  initialItems?: StoryboardItem[]
  storyId?: string
  outlineId?: string
  autoGenerate?: "all" | "script"
}

export function StoryboardList({
  initialItems = [],
  storyId: initialStoryId,
  outlineId: initialOutlineId,
  autoGenerate
}: StoryboardListProps): ReactElement {
  const router = useRouter()
  // Data & State
  const {
    items,
    setItems,
    updateItemById,
    selectedItems,
    setSelectedItems,
    episodes,
    outlineById,
    activeEpisode,
    setActiveEpisode,
    reloadShots,
    storyId,
    isLoading,
    loadError
  } = useStoryboardData({ initialItems, storyId: initialStoryId, outlineId: initialOutlineId })

  // Actions
  const {
    handleAddRole,
    handleAddItem,
    handleDelete,
    handleBatchDelete,
    toggleSelectAll,
    toggleSelect
  } = useStoryboardActions({
    items,
    setItems,
    updateItemById,
    selectedItems,
    setSelectedItems,
    activeEpisode,
    reloadShots,
    requestConfirm,
    notifyError
  })

  const previewsById = useStoryboardPreviews({ storyId, items })

  // Script Generation
  const {
    scriptGenerateById,
    generateScriptForItem,
    runTasksWithConcurrency,
    scriptGenerateSummary
  } = useScriptGeneration({ items, updateItemById })

  // UI States
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
  } | null>(null)
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null)
  const [preview, setPreview] = useState<{
    title: string
    imageSrc: string
    generatedImageId?: string
    storyboardId?: string | null
    category?: string | null
    description?: string | null
    prompt?: string | null
  } | null>(
    null
  )
  const [details, setDetails] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [addRoleModal, setAddRoleModal] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [addItemModal, setAddItemModal] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [editText, setEditText] = useState<{ open: boolean; itemId: string; initialValue: string; kind: StoryboardTextEditKind }>({
    open: false,
    itemId: "",
    initialValue: "",
    kind: "storyboardText"
  })
  const [editTextSaving, setEditTextSaving] = useState(false)
  const [editTextError, setEditTextError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const autoOpenedPanelRef = useRef(false)
  const [refImageGeneratingById, setRefImageGeneratingById] = useState<Record<string, boolean>>({})
  const [createVideoBusy, setCreateVideoBusy] = useState(false)
  const { isAutoGenerating, generationStage, generationEpisodeId, textBatchMeta, scriptSummary, promptSummary, assetSummary, episodeProgressById } = useAutoGenerateStoryboards({
    autoGenerate,
    storyId: initialStoryId,
    outlineId: initialOutlineId,
    outlineById,
    activeEpisode,
    setItems,
    reloadShots,
    generateScriptForItem,
    runTasksWithConcurrency
  })
  const { regenStatus, handleRegenerateActiveEpisode } = useEpisodeRegeneration({
    storyId,
    activeEpisode,
    outlineById,
    setItems,
    reloadShots,
    generateScriptForItem,
    runTasksWithConcurrency
  })

  const generationPanelModel = useGenerationPanelModel({
    episodes,
    generationStage,
    generationEpisodeId,
    textBatchMeta,
    episodeProgressById,
    scriptGenerateSummary,
    scriptSummary,
    promptSummary,
    assetSummary
  })

  useEffect(() => {
    if (autoOpenedPanelRef.current) return
    if (!autoGenerate) return
    if (!isAutoGenerating && generationStage === "idle") return
    autoOpenedPanelRef.current = true
    setPanelOpen(true)
  }, [autoGenerate, generationStage, isAutoGenerating])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) confirmResolverRef.current(false)
      confirmResolverRef.current = null
    }
  }, [])

  async function requestConfirm(params: { title: string; message: string; confirmText?: string; cancelText?: string }) {
    if (confirmResolverRef.current) confirmResolverRef.current(false)
    return await new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve
      setConfirmDelete({
        open: true,
        title: params.title,
        message: params.message,
        confirmText: params.confirmText,
        cancelText: params.cancelText
      })
    })
  }

  function notifyError(message: string) {
    setNotice({ type: "error", message })
  }

  // Handlers
  const openPreview = (
    title: string,
    imageSrc?: string,
    generatedImageId?: string,
    storyboardId?: string | null,
    category?: string | null,
    description?: string | null,
    prompt?: string | null
  ) => {
    setPreview({
      title,
      imageSrc: imageSrc || createPreviewSvgDataUrl(title, "预览"),
      generatedImageId,
      storyboardId,
      category,
      description,
      prompt
    })
  }

  const closePreview = () => setPreview(null)

  const openDetails = (itemId: string) => {
    setDetails({ open: true, itemId })
  }

  const closeDetails = () => setDetails({ open: false, itemId: "" })

  const handleSaveDetailsEdits = async (params: {
    itemId: string
    storyboardText: string
    firstPrompt: string
    lastPrompt: string
    videoPrompt: string
    regenerateAfterSave: boolean
  }) => {
    const res = await fetch("/api/video/storyboards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyboardId: params.itemId,
        storyboardText: params.storyboardText,
        frames: { first: { prompt: params.firstPrompt }, last: { prompt: params.lastPrompt } },
        videoInfo: { prompt: params.videoPrompt }
      })
    })
    const json = (await res.json().catch(() => null)) as
      | {
          ok: boolean
          data?: {
            storyboardId: string
            storyboardText?: string
            frames?: { first?: { prompt?: string | null }; last?: { prompt?: string | null } }
            videoInfo?: { prompt?: string | null }
          }
          error?: { message?: string }
        }
      | null
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)

    updateItemById(params.itemId, (it) => ({
      ...it,
      storyboard_text: json?.data?.storyboardText ?? params.storyboardText,
      frames: {
        ...(it.frames ?? {}),
        first: { ...(it.frames?.first ?? {}), prompt: json?.data?.frames?.first?.prompt ?? params.firstPrompt },
        last: { ...(it.frames?.last ?? {}), prompt: json?.data?.frames?.last?.prompt ?? params.lastPrompt }
      },
      videoInfo: { ...(it.videoInfo ?? {}), prompt: json?.data?.videoInfo?.prompt ?? params.videoPrompt }
    }))

    if (params.regenerateAfterSave) {
      void triggerGenerateForStoryboard(params.itemId, json?.data?.storyboardText ?? params.storyboardText)
    }
  }

  const handleOpenEdit = (params: OpenStoryboardTextEditParams) => {
    setEditText({ open: true, itemId: params.itemId, initialValue: params.initialValue, kind: params.kind })
    setEditTextError(null)
  }

  const triggerGenerateForStoryboard = async (storyboardId: string, storyboardText: string) => {
    const base = items.find((it) => it.id === storyboardId)
    if (!base) return
    const patched = { ...base, storyboard_text: storyboardText }
    const script = await generateScriptForItem(patched)
    if (!script) return

    await generateStoryboardPrompts(storyboardId)

    if (storyId && activeEpisode) {
      const latest = await fetchStoryboards(storyId, activeEpisode)
      const next = latest.find((it) => it.id === storyboardId)
      if (next) {
        updateItemById(storyboardId, (prev) => ({
          ...prev,
          frames: next.frames,
          videoInfo: next.videoInfo ?? prev.videoInfo,
          scriptContent: next.scriptContent ?? prev.scriptContent
        }))
      }
    }
  }

  const handleGenerateReferenceImages = async (storyboardId: string) => {
    if (!storyId) {
      setNotice({ type: "error", message: "缺少 storyId，无法生成参考图" })
      return
    }
    if (refImageGeneratingById[storyboardId]) return
    setRefImageGeneratingById((prev) => ({ ...prev, [storyboardId]: true }))
    try {
      const base = items.find((it) => it.id === storyboardId)
      if (!base) {
        setNotice({ type: "error", message: "未找到对应分镜，无法生成参考图" })
        return
      }

      const script = base.scriptContent ? base.scriptContent : await generateScriptForItem(base)
      if (!script) {
        setNotice({ type: "error", message: "脚本生成失败，无法生成参考图" })
        return
      }

      const prompts = extractReferenceImagePrompts(script)
      if (prompts.length === 0) {
        setNotice({ type: "info", message: "未解析到参考图提示词；请先完善分镜描述或重新生成脚本" })
        return
      }

      try {
        const jobId = await startReferenceImageJob({
          storyId,
          storyboardId,
          prompts: prompts.map((p) => ({
            name: p.name,
            prompt: p.prompt,
            description: p.description,
            category: p.category === "reference" ? "item" : p.category
          }))
        })
        await waitReferenceImageJob(jobId).catch(() => {})
        window.dispatchEvent(new Event("video_reference_images_updated"))
      } catch (e) {
        const anyErr = e as { message?: string }
        setNotice({ type: "error", message: anyErr?.message ?? "参考图任务启动失败" })
      }
    } finally {
      setRefImageGeneratingById((prev) => ({ ...prev, [storyboardId]: false }))
    }
  }

  const handleSaveEditText = async (value: string) => {
    if (!editText.itemId) return
    setEditTextSaving(true)
    setEditTextError(null)
    try {
      const body: Record<string, unknown> = { storyboardId: editText.itemId }
      if (editText.kind === "storyboardText") {
        body.storyboardText = value
      } else if (editText.kind === "firstFramePrompt") {
        body.frames = { first: { prompt: value } }
      } else if (editText.kind === "lastFramePrompt") {
        body.frames = { last: { prompt: value } }
      } else if (editText.kind === "videoPrompt") {
        body.videoInfo = { prompt: value }
      }

      const res = await fetch("/api/video/storyboards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok: boolean
            data?: {
              storyboardId: string
              storyboardText?: string
              frames?: { first?: { prompt?: string | null }; last?: { prompt?: string | null } }
              videoInfo?: { prompt?: string | null }
            }
            error?: { message?: string }
          }
        | null
      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }
      if (editText.kind === "storyboardText") {
        const storyboardText = json.data.storyboardText ?? value
        updateItemById(editText.itemId, (it) => ({ ...it, storyboard_text: storyboardText }))
        setEditText({ open: false, itemId: "", initialValue: "", kind: "storyboardText" })
        void triggerGenerateForStoryboard(editText.itemId, storyboardText)
      } else if (editText.kind === "firstFramePrompt") {
        const nextPrompt = json.data.frames?.first?.prompt ?? value
        updateItemById(editText.itemId, (it) => ({
          ...it,
          frames: { ...(it.frames ?? {}), first: { ...(it.frames?.first ?? {}), prompt: nextPrompt } }
        }))
        setEditText({ open: false, itemId: "", initialValue: "", kind: "storyboardText" })
      } else if (editText.kind === "lastFramePrompt") {
        const nextPrompt = json.data.frames?.last?.prompt ?? value
        updateItemById(editText.itemId, (it) => ({
          ...it,
          frames: { ...(it.frames ?? {}), last: { ...(it.frames?.last ?? {}), prompt: nextPrompt } }
        }))
        setEditText({ open: false, itemId: "", initialValue: "", kind: "storyboardText" })
      } else if (editText.kind === "videoPrompt") {
        const nextPrompt = json.data.videoInfo?.prompt ?? value
        updateItemById(editText.itemId, (it) => ({
          ...it,
          videoInfo: { ...(it.videoInfo ?? {}), prompt: nextPrompt }
        }))
        setEditText({ open: false, itemId: "", initialValue: "", kind: "storyboardText" })
      }
    } catch (e) {
      const anyErr = e as { message?: string }
      setEditTextError(anyErr?.message ?? "保存失败")
    } finally {
      setEditTextSaving(false)
    }
  }

  const handleCreateVideo = async () => {
    const sid = (storyId ?? "").trim()
    if (!sid) return
    if (createVideoBusy) return
    setCreateVideoBusy(true)
    setNotice(null)
    try {
      const outlines = Object.values(outlineById ?? {}).filter((o) => Boolean(o?.id))
      const firstOutline = outlines.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0]
      const firstOutlineId = (firstOutline?.id ?? "").trim()
      if (!firstOutlineId) {
        setNotice({ type: "error", message: "未找到第一集（outlines 为空）" })
        return
      }

      const firstEpisodeItems = await fetchStoryboards(sid, firstOutlineId)
      const firstItem = firstEpisodeItems.sort((a, b) => a.scene_no - b.scene_no)[0]
      const firstStoryboardId = (firstItem?.id ?? "").trim()
      if (!firstStoryboardId) {
        setNotice({ type: "error", message: "未找到第一集的第一分镜" })
        return
      }

      const qs = new URLSearchParams({
        storyId: sid,
        outlineId: firstOutlineId,
        storyboardId: firstStoryboardId,
        sceneNo: "1"
      })
      router.push(`/video/image?${qs.toString()}`)
    } catch (e) {
      const anyErr = e as { message?: unknown }
      setNotice({ type: "error", message: typeof anyErr?.message === "string" ? anyErr.message : "跳转失败" })
    } finally {
      setCreateVideoBusy(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {details.open && details.itemId ? (
        (() => {
          const it = items.find((x) => x.id === details.itemId)
          if (!it) return null
          return (
            <StoryboardDetailsModal
              open
              item={it}
              previews={previewsById[it.id]}
              onClose={closeDetails}
              onPreviewImage={openPreview}
              onSaveEdits={handleSaveDetailsEdits}
            />
          )
        })()
      ) : null}
      {addRoleModal.open && (
        <ChipEditModal
          open={addRoleModal.open}
          title="添加角色"
          placeholder="请输入角色名"
          onClose={() => setAddRoleModal({ open: false, itemId: "" })}
          onSubmit={(value) => {
            if (!addRoleModal.itemId) return
            handleAddRole(addRoleModal.itemId, value)
            setAddRoleModal({ open: false, itemId: "" })
          }}
        />
      )}
      {addItemModal.open && (
        <ChipEditModal
          open={addItemModal.open}
          title="添加物品"
          placeholder="请输入物品名称"
          optionLabels={{ left: "角色物品", right: "场景物品" }}
          defaultOption="left"
          onClose={() => setAddItemModal({ open: false, itemId: "" })}
          onSubmit={(value, option) => {
            if (!addItemModal.itemId) return
            handleAddItem(addItemModal.itemId, option === "left" ? "role_items" : "other_items", value)
            setAddItemModal({ open: false, itemId: "" })
          }}
        />
      )}
      {preview ? (
        <ImagePreviewModal
          key={`${preview.storyboardId ?? "global"}:${preview.generatedImageId ?? preview.imageSrc}`}
          open
          title={preview.title}
          imageSrc={preview.imageSrc}
          generatedImageId={preview.generatedImageId}
          storyId={storyId ?? null}
          storyboardId={preview.storyboardId ?? null}
          category={preview.category ?? null}
          description={preview.description ?? null}
          prompt={preview.prompt ?? null}
          onClose={closePreview}
        />
      ) : null}
      {confirmDelete?.open ? (
        <ConfirmModal
          open={confirmDelete.open}
          title={confirmDelete.title}
          message={confirmDelete.message}
          confirmText={confirmDelete.confirmText ?? "删除"}
          cancelText={confirmDelete.cancelText ?? "取消"}
          confirming={false}
          onCancel={() => {
            setConfirmDelete(null)
            if (confirmResolverRef.current) confirmResolverRef.current(false)
            confirmResolverRef.current = null
          }}
          onConfirm={() => {
            setConfirmDelete(null)
            if (confirmResolverRef.current) confirmResolverRef.current(true)
            confirmResolverRef.current = null
          }}
        />
      ) : null}
      {editText.open ? (
        <StoryboardTextModal
          open={editText.open}
          title={`${(() => {
            const sceneNo = items.find((it) => it.id === editText.itemId)?.scene_no ?? ""
            const suffix = sceneNo ? `（镜号 ${sceneNo}）` : ""
            if (editText.kind === "firstFramePrompt") return `编辑首帧图提示词${suffix}`
            if (editText.kind === "lastFramePrompt") return `编辑尾帧图提示词${suffix}`
            if (editText.kind === "videoPrompt") return `编辑视频提示词${suffix}`
            return `编辑分镜描述${suffix}`
          })()}`}
          initialValue={editText.initialValue}
          saving={editTextSaving}
          error={editTextError}
          onClose={() => {
            if (editTextSaving) return
            setEditText({ open: false, itemId: "", initialValue: "", kind: "storyboardText" })
            setEditTextError(null)
          }}
          onSave={handleSaveEditText}
        />
      ) : null}

      <StoryboardSidebar
        episodes={episodes}
        activeEpisode={activeEpisode}
        outlineById={outlineById}
        storyId={initialStoryId}
        isBusy={isLoading}
        onEpisodeClick={(id, options) => {
          if (options?.force) {
            setItems([])
            void reloadShots(id)
            return
          }
          setActiveEpisode(id)
        }}
      />

      <div className={styles.mainContent}>
        <StoryboardToolbar
          totalCount={items.length}
          isLoading={isLoading || isAutoGenerating}
          loadError={loadError}
          selectedCount={selectedItems.size}
          onBatchDelete={handleBatchDelete}
          onCreateVideo={handleCreateVideo}
          createVideoDisabled={Boolean(createVideoBusy || isLoading || isAutoGenerating || !storyId)}
          onRegenerateEpisode={handleRegenerateActiveEpisode}
          regenerateDisabled={regenStatus.status === "running" || Boolean(isLoading || isAutoGenerating) || !storyId || !activeEpisode}
          regenerateStatusText={regenStatus.status === "idle" ? null : regenStatus.message}
        />
        {notice ? (
          <div className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeInfo}`} role="status">
            {notice.message}
          </div>
        ) : null}
        {(isAutoGenerating || generationStage !== "idle") ? (
          <GenerationPanel
            open={panelOpen}
            onToggleOpen={() => setPanelOpen((v) => !v)}
            title={generationPanelModel.title}
            episodeBars={generationPanelModel.episodeBars}
            steps={generationPanelModel.steps}
          />
        ) : null}

        <StoryboardTable
          items={items}
          storyId={storyId}
          outlineId={activeEpisode ?? undefined}
          updateItemById={updateItemById}
          selectedItems={selectedItems}
          scriptGenerateById={scriptGenerateById}
          isLoading={isLoading || isAutoGenerating}
          onSelectAll={toggleSelectAll}
          onSelect={toggleSelect}
          previewsById={previewsById}
          onPreviewImage={openPreview}
          onGenerateReferenceImages={handleGenerateReferenceImages}
          refImageGeneratingById={refImageGeneratingById}
          onOpenEdit={handleOpenEdit}
          onOpenDetails={openDetails}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
