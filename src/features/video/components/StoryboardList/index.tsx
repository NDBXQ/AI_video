import { type ReactElement, useState, useEffect } from "react"
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
import { StoryboardSidebar } from "./StoryboardSidebar"
import { StoryboardToolbar } from "./StoryboardToolbar"
import { StoryboardTable } from "./StoryboardTable"
import { GenerationPanel, type GenerationStep, type GenerationStepStatus } from "./GenerationPanel"
import { ActiveJobsPanel } from "./ActiveJobsPanel"

type StoryboardListProps = {
  initialItems?: StoryboardItem[]
  storyId?: string
  outlineId?: string
  autoGenerate?: boolean
}

export function StoryboardList({
  initialItems = [],
  storyId: initialStoryId,
  outlineId: initialOutlineId,
  autoGenerate
}: StoryboardListProps): ReactElement {
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
    setScriptGenerateById,
    generateScriptForItem,
    runTasksWithConcurrency,
    scriptGenerateSummary,
    isAnyScriptGenerating
  } = useScriptGeneration({ items, updateItemById })

  // UI States
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
  const [addRoleModal, setAddRoleModal] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [addItemModal, setAddItemModal] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: "" })
  const [editText, setEditText] = useState<{ open: boolean; itemId: string; initialValue: string }>({ open: false, itemId: "", initialValue: "" })
  const [editTextSaving, setEditTextSaving] = useState(false)
  const [editTextError, setEditTextError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
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

  useEffect(() => {
    if (isAutoGenerating) setPanelOpen(false)
  }, [isAutoGenerating])

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

  const handleGenerateScript = async () => {
    const candidates = items.filter((it) => (it.storyboard_text ?? "").trim().length > 0)
    if (candidates.length === 0) return
    setScriptGenerateById((prev) => {
      const next: Record<string, ScriptGenerateState> = { ...prev }
      for (const it of candidates) {
        next[it.id] = { status: "generating", tone: "info", message: "脚本生成中…" }
      }
      return next
    })
    const tasks = candidates.map((it) => async () => {
      await generateScriptForItem(it)
    })
    await runTasksWithConcurrency(tasks, 4)
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
    } catch (e) {
      const anyErr = e as { message?: string }
      setEditTextError(anyErr?.message ?? "保存失败")
    } finally {
      setEditTextSaving(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Modals */}
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
      <ImagePreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ""}
        imageSrc={preview?.imageSrc ?? ""}
        generatedImageId={preview?.generatedImageId}
        storyboardId={preview?.storyboardId ?? null}
        category={preview?.category ?? null}
        description={preview?.description ?? null}
        prompt={preview?.prompt ?? null}
        onClose={closePreview}
      />
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

      {/* Sidebar */}
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
        {/* <ActiveJobsPanel storyId={storyId} /> */}
        {/* Toolbar */}
        <StoryboardToolbar
          totalCount={items.length}
          isLoading={isLoading || isAutoGenerating}
          loadError={loadError}
          selectedCount={selectedItems.size}
          isAnyScriptGenerating={isAnyScriptGenerating}
          scriptGenerateSummary={scriptGenerateSummary}
          onBatchDelete={handleBatchDelete}
          onGenerateScript={handleGenerateScript}
        />
        {(isAutoGenerating || generationStage !== "idle") ? (
          <GenerationPanel
            open={panelOpen}
            onToggleOpen={() => setPanelOpen((v) => !v)}
            title={`正在生成：${
              (textBatchMeta?.total ?? 0) > 1
                ? "全部剧集"
                : generationEpisodeId
                  ? (episodes.find((e) => e.id === generationEpisodeId)?.name ?? "分镜")
                  : "分镜"
            }`}
            episodeBars={episodes
              .map((ep) => {
                const st = episodeProgressById?.[ep.id]
                const textDone = st?.textStatus ? 1 : 0
                const scriptTotal = st?.script?.total ?? 0
                const scriptDone = (st?.script?.done ?? 0) + (st?.script?.failed ?? 0)
                const promptTotal = st?.prompts?.total ?? 0
                const promptDone = (st?.prompts?.done ?? 0) + (st?.prompts?.failed ?? 0)
                const assetTotal = st?.assets?.total ?? 0
                const assetDone = (st?.assets?.done ?? 0) + (st?.assets?.failed ?? 0)

                const scriptProgress = scriptTotal > 0 ? scriptDone / scriptTotal : 0
                const promptProgress = promptTotal > 0 ? promptDone / promptTotal : 0
                const assetProgress = assetTotal > 0 ? assetDone / assetTotal : 0
                const overall = (textDone + scriptProgress + promptProgress + assetProgress) / 4

                const hasError =
                  st?.textStatus === "error" || (st?.script?.failed ?? 0) > 0 || (st?.prompts?.failed ?? 0) > 0 || (st?.assets?.failed ?? 0) > 0
                const isComplete = overall >= 1
                const tone: GenerationStepStatus = hasError ? "error" : isComplete ? "success" : "running"

                const meta = [
                  st?.textStatus === "success" ? "文本✓" : st?.textStatus === "error" ? "文本×" : "文本…",
                  scriptTotal > 0 ? `脚本 ${scriptDone}/${scriptTotal}` : null,
                  promptTotal > 0 ? `提示词 ${promptDone}/${promptTotal}` : null,
                  assetTotal > 0 ? `参考图 ${assetDone}/${assetTotal}` : null
                ]
                  .filter(Boolean)
                  .join(" · ")

                return { id: ep.id, label: ep.name, percent: Math.round(overall * 100), tone, meta }
              })
              .filter((b) => Boolean(b.id))}
            steps={((): GenerationStep[] => {
              const textMeta = textBatchMeta ? `${Math.max(0, textBatchMeta.total - textBatchMeta.failed)}/${textBatchMeta.total}` : ""
              const scriptMeta =
                scriptSummary ? `${scriptSummary.done + scriptSummary.failed}/${scriptSummary.total}` : (scriptGenerateSummary.total > 0 ? `${scriptGenerateSummary.done}/${scriptGenerateSummary.total}` : "")
              const promptMeta = promptSummary ? `${promptSummary.done + promptSummary.failed}/${promptSummary.total}` : ""
              const assetMeta = assetSummary ? `${assetSummary.done + assetSummary.failed}/${assetSummary.total}` : ""
              return [
                { key: "clear", label: "清理旧分镜数据", status: generationStage === "clearing" ? "running" : generationStage === "idle" ? "pending" : "success" },
                { key: "text", label: "生成分镜文本", status: generationStage === "storyboard_text" ? "running" : generationStage === "error" ? "error" : generationStage === "idle" ? "pending" : "success", meta: textMeta },
                { key: "script", label: "生成分镜脚本", status: generationStage === "script" ? "running" : generationStage === "idle" ? "pending" : generationStage === "error" ? "error" : "success", meta: scriptMeta },
                { key: "prompts", label: "生成提示词", status: generationStage === "assets" ? "running" : generationStage === "idle" ? "pending" : generationStage === "error" ? "error" : "success", meta: promptMeta },
                { key: "assets", label: "生成参考图", status: generationStage === "assets" ? "running" : generationStage === "idle" ? "pending" : generationStage === "error" ? "error" : "success", meta: assetMeta }
              ]
            })()}
          />
        ) : null}

        {/* Table */}
        <StoryboardTable
          items={items}
          selectedItems={selectedItems}
          scriptGenerateById={scriptGenerateById}
          isLoading={isLoading || isAutoGenerating}
          onSelectAll={toggleSelectAll}
          onSelect={toggleSelect}
          previewsById={previewsById}
          onPreviewImage={openPreview}
          onOpenEdit={(itemId, initialValue) => {
            setEditText({ open: true, itemId, initialValue })
            setEditTextError(null)
          }}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
