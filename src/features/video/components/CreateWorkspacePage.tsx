"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceData } from "../hooks/useWorkspaceData"
import { useWorkspaceState } from "../hooks/useWorkspaceState"
import { useGenerationActions } from "../hooks/useGenerationActions"
import { MediaPreviewPanel } from "./CreatePage/MediaPreviewPanel"
import { GenerationHeader } from "./CreatePage/GenerationHeader"
import { ImageParamsSidebar } from "./CreatePage/ImageParamsSidebar"
import { VideoParamsSidebar } from "./CreatePage/VideoParamsSidebar"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { createLocalPreviewSvg, uniqueStrings, clampInt } from "../utils/previewUtils"
import shellStyles from "./ImageCreate/Shell.module.css"

export function CreateWorkspacePage({
  initialTab,
  sceneNo,
  storyboardId,
  storyId,
  outlineId
}: {
  initialTab: "image" | "video"
  sceneNo: number
  storyboardId?: string
  storyId?: string
  outlineId?: string
}): ReactElement {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"image" | "video">(initialTab)
  const [activeStoryboardId, setActiveStoryboardId] = useState<string>(storyboardId ?? "")
  const [timelineDraft, setTimelineDraft] = useState<{ videoClips: any[]; audioClips: any[] } | null>(null)
  const timelineSaveTimerRef = useRef<number | null>(null)

  const {
    items,
    setItems,
    isLoading,
    loadError,
    activePreviews
  } = useWorkspaceData({
    storyId,
    outlineId,
    storyboardId,
    activeStoryboardId,
    setActiveStoryboardId
  })

  const activeItem = useMemo(
    () => items.find((it) => it.id === activeStoryboardId) ?? items[0] ?? null,
    [activeStoryboardId, items]
  )
  const activeSceneNo = activeItem?.scene_no ?? sceneNo
  const hasExistingVideo = Boolean((activeItem?.videoInfo?.url ?? "").trim() || (activeItem?.videoInfo?.storageKey ?? "").trim())

  const {
    imagePrompt, setImagePrompt,
    lastImagePrompt, setLastImagePrompt,
    videoPrompt, setVideoPrompt,
    hasVoice, setHasVoice,
    sceneText, setSceneText,
    roles, setRoles,
    roleItems, setRoleItems,
    storyboardMode, setStoryboardMode,
    durationSeconds, setDurationSeconds,
    addModal, setAddModal,
    previewImageSrcById, setPreviewImageSrcById,
    previewVideoSrcById, setPreviewVideoSrcById,
    preview, setPreview
  } = useWorkspaceState({ activeItem, storyId, outlineId, activeTab })

  const { handleGenerateImage, handleGenerateVideo, isGeneratingImage, isGeneratingVideo } = useGenerationActions({
    activeStoryboardId,
    activeSceneNo,
    imagePrompt,
    lastImagePrompt,
    videoPrompt,
    hasVoice,
    existingFirstFrameUrl: (activeItem?.frames?.first?.url ?? activeItem?.frames?.first?.thumbnailUrl ?? null) as any,
    existingLastFrameUrl: (activeItem?.frames?.last?.url ?? activeItem?.frames?.last?.thumbnailUrl ?? null) as any,
    storyId,
    sceneText,
    roles,
    roleItems,
    activePreviews,
    storyboardMode,
    durationSeconds,
    hasExistingVideo,
    setPreviewImageSrcById,
    setPreviewVideoSrcById,
    previewImageSrcById,
    setItems
  })

  const thumbnails = useMemo(() => {
    if (items.length === 0) {
      return [{ id: activeStoryboardId || `scene-${sceneNo}`, title: `镜 ${sceneNo}`, imageSrc: createLocalPreviewSvg(`镜 ${sceneNo}`) }]
    }
    return items.map((it) => ({
      id: it.id,
      title: `镜 ${it.scene_no}`,
      imageSrc:
        (activeTab === "video"
          ? previewVideoSrcById[it.id] ?? it.videoInfo?.url ?? createLocalPreviewSvg(`镜 ${it.scene_no} / 未生成`)
          : (() => {
              const local = (previewImageSrcById[it.id] ?? "").trim()
              if (local.startsWith("http") || local.startsWith("data:")) return local

              const dbUrl = (it.frames?.first?.url ?? "").trim()
              const dbThumb = (it.frames?.first?.thumbnailUrl ?? "").trim()
              const isComposed = (u: string) => u.includes("composed_")
              if (dbUrl && isComposed(dbUrl)) return dbUrl
              if (dbThumb && isComposed(dbThumb)) return dbThumb
              return createLocalPreviewSvg(`镜 ${it.scene_no}`)
            })())
    }))
  }, [activeStoryboardId, activeTab, items, previewImageSrcById, previewVideoSrcById, sceneNo])

  useEffect(() => {
    if (!storyId) return
    let ignore = false
    const load = async () => {
      try {
        const res = await fetch(`/api/video/timeline?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" })
        const json = (await res.json()) as { ok: boolean; data?: { timeline?: any } }
        if (!res.ok || !json?.ok) return
        const tl = json.data?.timeline
        if (ignore) return
        if (tl && typeof tl === "object") {
          setTimelineDraft({
            videoClips: Array.isArray((tl as any).videoClips) ? (tl as any).videoClips : [],
            audioClips: Array.isArray((tl as any).audioClips) ? (tl as any).audioClips : []
          })
        } else {
          setTimelineDraft(null)
        }
      } catch {}
    }
    void load()
    return () => {
      ignore = true
    }
  }, [storyId])

  useEffect(() => {
    return () => {
      if (timelineSaveTimerRef.current) {
        window.clearTimeout(timelineSaveTimerRef.current)
        timelineSaveTimerRef.current = null
      }
    }
  }, [])

  const queueSaveTimeline = useCallback((next: { videoClips: any[]; audioClips: any[] }) => {
    if (!storyId) return
    setTimelineDraft(next)
    if (timelineSaveTimerRef.current) window.clearTimeout(timelineSaveTimerRef.current)
    timelineSaveTimerRef.current = window.setTimeout(() => {
      timelineSaveTimerRef.current = null
      void fetch("/api/video/timeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, timeline: { version: 1, ...next } })
      }).catch(() => {})
    }, 800)
  }, [storyId])

  const handleTimelineChange = useCallback((tl: { videoClips: any[]; audioClips: any[] }) => queueSaveTimeline(tl), [queueSaveTimeline])

  const timelineSegments = useMemo(() => {
    if (activeTab !== "video") return []
    const isVideoUrl = (src: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src)
    return items.map((it) => {
      const candidate = (previewVideoSrcById[it.id] ?? it.videoInfo?.url ?? "").trim()
      const videoSrc = candidate && isVideoUrl(candidate) ? candidate : null
      const durationSeconds =
        typeof it.videoInfo?.durationSeconds === "number" &&
        Number.isFinite(it.videoInfo.durationSeconds) &&
        it.videoInfo.durationSeconds > 0
          ? it.videoInfo.durationSeconds
          : null
      return { id: it.id, title: `镜 ${it.scene_no}`, videoSrc, durationSeconds }
    })
  }, [activeTab, items, previewVideoSrcById])

  const activePreview = useMemo(
    () => thumbnails.find((it) => it.id === activeStoryboardId) ?? thumbnails[0],
    [activeStoryboardId, thumbnails]
  )

  const activeFrameImages = useMemo(() => {
    if (!activeItem) return { first: null, last: null }
    const local = (previewImageSrcById[activeItem.id] ?? "").trim()
    const firstFromDb = ((activeItem.frames?.first?.url ?? "").trim() || (activeItem.frames?.first?.thumbnailUrl ?? "").trim()) || null
    const lastFromDb = ((activeItem.frames?.last?.url ?? "").trim() || (activeItem.frames?.last?.thumbnailUrl ?? "").trim()) || null
    const first = local.startsWith("http") || local.startsWith("data:") ? local : firstFromDb
    return { first, last: lastFromDb }
  }, [activeItem, previewImageSrcById])

  const handleBack = () => {
    const qs = new URLSearchParams({ tab: "board" })
    if (storyId) qs.set("storyId", storyId)
    if (outlineId) qs.set("outlineId", outlineId)
    router.push(`/video?${qs.toString()}`)
  }

  const switchTab = (tab: "image" | "video") => {
    setActiveTab(tab)
    // URL sync is handled in useWorkspaceState or we can do it here if needed, 
    // but useWorkspaceState has an effect that watches activeTab.
    // However, the original code had URL sync in switchTab AND useEffect.
    // The hook has it in useEffect dependent on activeTab.
  }

  if (isLoading) return <div className={shellStyles.shell}>加载中…</div>
  if (loadError) return <div className={shellStyles.shell}>{loadError}</div>

  return (
    <div className={shellStyles.shell} aria-label="生图/生视频工作台">
      <ImagePreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ""}
        imageSrc={preview?.imageSrc ?? ""}
        generatedImageId={preview?.generatedImageId}
        storyboardId={preview?.storyboardId ?? activeStoryboardId}
        category={preview?.category ?? null}
        description={preview?.description ?? null}
        prompt={preview?.prompt ?? null}
        onClose={() => setPreview(null)}
      />
      <GenerationHeader
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={(tab) => switchTab(tab)}
        sceneNo={activeSceneNo}
        info={[
          ...(activeTab === "video" ? [{ label: "时长", value: `${clampInt(durationSeconds, 4, 12, 4)}s` }] : [])
        ]}
      />

      <div className={shellStyles.body}>
        {activeTab === "image" ? (
          <ImageParamsSidebar
            key={`image-sidebar-${activeStoryboardId}`}
            prompt={imagePrompt}
            setPrompt={setImagePrompt}
            tailPrompt={lastImagePrompt}
            setTailPrompt={setLastImagePrompt}
            isGenerating={isGeneratingImage}
            sceneText={sceneText}
            setSceneText={setSceneText}
            roles={roles}
            setRoles={setRoles}
            items={roleItems}
            setItems={setRoleItems}
            onGenerate={handleGenerateImage}
            onPreviewImage={(title, imageSrc, generatedImageId, storyboardId, category, description, prompt) =>
              setPreview({ title, imageSrc, generatedImageId, storyboardId: storyboardId ?? activeStoryboardId, category, description, prompt })
            }
            previews={activePreviews}
          />
        ) : (
          <VideoParamsSidebar
            prompt={videoPrompt}
            setPrompt={setVideoPrompt}
            storyboardMode={storyboardMode}
            setStoryboardMode={setStoryboardMode}
            durationSeconds={durationSeconds}
            setDurationSeconds={setDurationSeconds}
            hasVoice={hasVoice}
            setHasVoice={setHasVoice}
            isGenerating={isGeneratingVideo}
            onGenerate={handleGenerateVideo}
          />
        )}

        <MediaPreviewPanel
          mode={activeTab}
          activeImageSrc={activePreview?.imageSrc ?? ""}
          activeFrameImages={activeTab === "image" ? activeFrameImages : undefined}
          activeTitle={activePreview?.title ?? ""}
          thumbnails={thumbnails}
          activeId={activeStoryboardId || thumbnails[0]?.id || ""}
          timelineSegments={timelineSegments}
          timelineKey={storyId ?? "no-story"}
          initialTimeline={timelineDraft}
          onTimelineChange={handleTimelineChange}
          onThumbnailClick={(id) => {
            if (id === activeStoryboardId) return
            setActiveStoryboardId(id)
          }}
        />
      </div>

      <ChipEditModal
        open={addModal.open}
        title={addModal.kind === "role" ? "选择角色" : addModal.kind === "item" ? "选择物品" : "选择背景"}
        placeholder={addModal.kind === "role" ? "请输入角色名" : addModal.kind === "item" ? "请输入物品" : "请输入背景"}
        onClose={() => setAddModal((p) => ({ ...p, open: false }))}
        onSubmit={(value) => {
          const trimmed = value.trim()
          if (!trimmed) return
          if (addModal.kind === "role") setRoles((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "item") setRoleItems((p) => uniqueStrings([...p, trimmed]))
          if (addModal.kind === "background") setSceneText(trimmed)
          setAddModal((p) => ({ ...p, open: false }))
        }}
      />
    </div>
  )
}
