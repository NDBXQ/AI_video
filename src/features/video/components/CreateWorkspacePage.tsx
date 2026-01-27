"use client"

import { useCallback, useMemo, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceData } from "../hooks/useWorkspaceData"
import { useWorkspaceState } from "../hooks/useWorkspaceState"
import { useGenerationActions } from "../hooks/useGenerationActions"
import { useTimelineDraft } from "../hooks/create-workspace/useTimelineDraft"
import { useVideoAssetGroups } from "../hooks/create-workspace/useVideoAssetGroups"
import { useFrameImagePreview } from "../hooks/create-workspace/useFrameImagePreview"
import { usePrevVideoLastFrame } from "../hooks/create-workspace/usePrevVideoLastFrame"
import { useWorkspaceThumbnails } from "../hooks/create-workspace/useWorkspaceThumbnails"
import { useWorkspaceDialogues } from "../hooks/create-workspace/useWorkspaceDialogues"
import { useTimelineSegments } from "../hooks/create-workspace/useTimelineSegments"
import { useSceneSwitch } from "../hooks/create-workspace/useSceneSwitch"
import { MediaPreviewPanel } from "./CreatePage/MediaPreviewPanel"
import { CreateWorkspaceMain } from "./CreatePage/CreateWorkspaceMain"
import { ImageParamsSidebar } from "./CreatePage/ImageParamsSidebar"
import { VideoParamsSidebar } from "./CreatePage/VideoParamsSidebar"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { ImageAssetPickerModal } from "./ImagePreview/ImageAssetPickerModal"
import { uniqueStrings, clampInt } from "../utils/previewUtils"
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
  const { timelineDraft, queueSaveTimeline } = useTimelineDraft(storyId)
  const videoAssetGroups = useVideoAssetGroups({ storyId, enabled: activeTab === "video" })

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
  const [ttsAudioVersion, setTtsAudioVersion] = useState(0)
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

  const thumbnails = useWorkspaceThumbnails({
    items,
    activeStoryboardId,
    sceneNo,
    activeTab,
    previewImageSrcById,
    previewVideoSrcById
  })

  const dialogues = useWorkspaceDialogues(activeItem)

  const handleTimelineChange = useCallback((tl: { videoClips: any[]; audioClips: any[] }) => queueSaveTimeline(tl), [queueSaveTimeline])

  const timelineSegments = useTimelineSegments({ activeTab, items, previewVideoSrcById, videoAssetGroups })

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

  const openFrameImagePreview = useFrameImagePreview({
    activeItem,
    activePreviewTitle: activePreview?.title ?? null,
    imagePrompt,
    lastImagePrompt,
    sceneText,
    setPreview
  })

  const handleBack = () => {
    const qs = new URLSearchParams({ tab: "board" })
    if (storyId) qs.set("storyId", storyId)
    if (outlineId) qs.set("outlineId", outlineId)
    router.push(`/video?${qs.toString()}`)
  }

  const sceneSwitch = useSceneSwitch(items, activeItem?.id)
  const [assetPicker, setAssetPicker] = useState<{ open: boolean; category: "background" | "role" | "item"; name: string }>({
    open: false,
    category: "background",
    name: ""
  })

  const { prevVideoLastFrameUrl, usePrevVideoLastFrameAsFirst } = usePrevVideoLastFrame({
    items,
    activeItem,
    activeStoryboardId,
    setItems,
    setPreviewImageSrcById
  })

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
        frameKind={preview?.frameKind ?? null}
        description={preview?.description ?? null}
        prompt={preview?.prompt ?? null}
        onStoryboardFrameUpdated={(p: { storyboardId: string; frameKind: "first" | "last"; url: string; thumbnailUrl: string | null }) => {
          const { storyboardId, frameKind, url, thumbnailUrl } = p
          if (!storyboardId) return
          if (frameKind === "first") setPreviewImageSrcById((prev) => ({ ...prev, [storyboardId]: url }))
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== storyboardId) return it
              const baseFrames = it.frames ?? {}
              const patch = frameKind === "first" ? { first: { ...(baseFrames.first ?? {}), url, thumbnailUrl } } : { last: { ...(baseFrames.last ?? {}), url, thumbnailUrl } }
              return { ...it, frames: { ...baseFrames, ...patch } as any }
            })
          )
        }}
        onClose={() => setPreview(null)}
      />
      <ImageAssetPickerModal
        open={assetPicker.open}
        title={assetPicker.name}
        entityName={assetPicker.name}
        storyboardId={activeStoryboardId}
        category={assetPicker.category}
        onPicked={({ url, thumbnailUrl, generatedImageId }) => {
          window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId: activeStoryboardId } }))
          setPreview({
            title: assetPicker.name,
            imageSrc: url,
            generatedImageId,
            storyboardId: activeStoryboardId,
            category: assetPicker.category,
            description: null,
            prompt: null,
            frameKind: null
          })
        }}
        onClose={() => setAssetPicker((p) => ({ ...p, open: false }))}
      />
      <CreateWorkspaceMain
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sceneNo={activeSceneNo}
        recommendedStoryboardMode={((activeItem?.videoInfo as any)?.settings?.mode as any) ?? null}
        canPrevScene={sceneSwitch.canPrev}
        canNextScene={sceneSwitch.canNext}
        onPrevScene={() => {
          if (!sceneSwitch.prevId) return
          setActiveStoryboardId(sceneSwitch.prevId)
        }}
        onNextScene={() => {
          if (!sceneSwitch.nextId) return
          setActiveStoryboardId(sceneSwitch.nextId)
        }}
        info={[...(activeTab === "video" ? [{ label: "时长", value: `${clampInt(durationSeconds, 4, 12, 4)}s` }] : [])]}
        leftPanel={
          activeTab === "image" ? (
            <ImageParamsSidebar
              key={`image-sidebar-${activeStoryboardId}`}
              prompt={imagePrompt}
              setPrompt={setImagePrompt}
              tailPrompt={lastImagePrompt}
              setTailPrompt={setLastImagePrompt}
              isGenerating={isGeneratingImage}
              recommendedStoryboardMode={((activeItem?.videoInfo as any)?.settings?.mode as any) ?? null}
              shotCut={Boolean(!activeItem?.shot_info?.cut_to)}
              prevVideoLastFrameUrl={prevVideoLastFrameUrl}
              onUsePrevVideoLastFrame={usePrevVideoLastFrameAsFirst}
              sceneText={sceneText}
              setSceneText={setSceneText}
              roles={roles}
              setRoles={setRoles}
              items={roleItems}
              setItems={setRoleItems}
              onGenerate={handleGenerateImage}
              onPickReferenceImage={({ category, name }) => {
                const n = name.trim()
                if (!n) return
                setAssetPicker({ open: true, category, name: n })
              }}
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
              storyboardId={activeStoryboardId}
              dialogues={dialogues}
              onAudioGenerated={() => setTtsAudioVersion((v) => v + 1)}
              onGenerate={handleGenerateVideo}
            />
          )
        }
        rightPanel={
          <div
            style={
              {
                gridColumn: 2,
                gridRow: "1 / span 2",
                minHeight: 0,
                ["--left-col-w" as any]: "340px",
                ["--col-gap" as any]: "8px"
              } as any
            }
          >
            <MediaPreviewPanel
              mode={activeTab}
              activeImageSrc={activePreview?.imageSrc ?? ""}
              activeFrameImages={activeTab === "image" ? activeFrameImages : undefined}
              activeTitle={activePreview?.title ?? ""}
              thumbnails={thumbnails}
              activeId={activeStoryboardId || thumbnails[0]?.id || ""}
              onOpenFrameImage={openFrameImagePreview}
              timelineSegments={timelineSegments}
              videoAssetGroups={activeTab === "video" ? videoAssetGroups : undefined}
              timelineKey={storyId ?? "no-story"}
              initialTimeline={timelineDraft}
              onTimelineChange={handleTimelineChange}
              storyboardId={activeStoryboardId}
              ttsAudioVersion={ttsAudioVersion}
              onThumbnailClick={(id) => {
                if (id === activeStoryboardId) return
                setActiveStoryboardId(id)
              }}
            />
          </div>
        }
      />

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
