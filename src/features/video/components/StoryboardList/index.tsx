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
  } = useStoryboardActions({ items, setItems, updateItemById, selectedItems, setSelectedItems, activeEpisode, reloadShots })

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
  const [editText, setEditText] = useState<{ open: boolean; itemId: string; initialValue: string }>({ open: false, itemId: "", initialValue: "" })
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

  const handleOpenEdit = (itemId: string, initialValue: string) => {
    setEditText({ open: true, itemId, initialValue })
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
      const res = await fetch("/api/video/storyboards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardId: editText.itemId, storyboardText: value })
      })
      const json = (await res.json()) as { ok: boolean; data?: { storyboardId: string; storyboardText: string }; error?: { message?: string } }
      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }
      updateItemById(editText.itemId, (it) => ({ ...it, storyboard_text: json.data!.storyboardText }))
      setEditText({ open: false, itemId: "", initialValue: "" })
      void triggerGenerateForStoryboard(editText.itemId, json.data.storyboardText)
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
              onOpenEdit={handleOpenEdit}
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
      {editText.open ? (
        <StoryboardTextModal
          open={editText.open}
          title={`编辑分镜描述（镜号 ${items.find((it) => it.id === editText.itemId)?.scene_no ?? ""}）`}
          initialValue={editText.initialValue}
          saving={editTextSaving}
          error={editTextError}
          onClose={() => {
            if (editTextSaving) return
            setEditText({ open: false, itemId: "", initialValue: "" })
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
