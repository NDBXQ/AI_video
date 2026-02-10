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
import { useWorkspaceEpisodeThumbnails } from "../hooks/create-workspace/useWorkspaceEpisodeThumbnails"
import { useWorkspaceEpisodeLabel } from "../hooks/create-workspace/useWorkspaceEpisodeLabel"
import { useWorkspaceDialogues } from "../hooks/create-workspace/useWorkspaceDialogues"
import { useTimelineSegments } from "../hooks/create-workspace/useTimelineSegments"
import { useSceneSwitch } from "../hooks/create-workspace/useSceneSwitch"
import { MediaPreviewPanel } from "./CreatePage/MediaPreviewPanel"
import { CreateWorkspaceMain } from "./CreatePage/CreateWorkspaceMain"
import { ImageParamsSidebar } from "./CreatePage/ImageParamsSidebar"
import { VideoParamsSidebar } from "./CreatePage/VideoParamsSidebar"
import { VideoParamsDrawer } from "./CreatePage/VideoParamsDrawer"
import { ChipEditModal } from "@/features/video/components/ChipEditModal"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { uniqueStrings, clampInt } from "@/shared/utils/previewUtils"
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
  const [videoParamsOpen, setVideoParamsOpen] = useState(false)
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

  const { handleGenerateImage, handleGenerateVideo, isGeneratingImage, isGeneratingVideo, imageRequest, videoRequest } = useGenerationActions({
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

  const episodeThumbnails = useWorkspaceEpisodeThumbnails({
    storyId,
    enabled: activeTab === "image",
    previewImageSrcById
  })

  const episodeLabel = useWorkspaceEpisodeLabel({
    storyId,
    outlineId,
    enabled: Boolean((storyId ?? "").trim() && (outlineId ?? "").trim())
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

  const { prevVideoLastFrameUrl, usePrevVideoLastFrameAsFirst } = usePrevVideoLastFrame({
    items,
    activeItem,
    activeStoryboardId,
    setItems,
    setPreviewImageSrcById
  })

  const persistStoryboardScriptContent = useCallback(async (storyboardId: string, nextScriptContent: unknown) => {
    const res = await fetch("/api/video/storyboards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyboardId, scriptContent: nextScriptContent })
    })
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: { message?: string } } | null
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  }, [])

  const computeNextScriptContent = useCallback((it: any, op: "add" | "remove", category: "role" | "item", nameRaw: string) => {
    const name = (nameRaw ?? "").trim()
    const current = (it?.scriptContent as any) ?? {}
    const shotContent = (current.shot_content as any) ?? {}
    const videoContent = (current.video_content as any) ?? {}
    const nextShotContent = { ...shotContent }
    const nextVideoContent = { ...videoContent }

    if (category === "role") {
      const roles = (Array.isArray(nextShotContent.roles) ? nextShotContent.roles.slice() : []) as any[]
      const vcRoles = (Array.isArray(nextVideoContent.roles) ? nextVideoContent.roles.slice() : []) as any[]
      if (op === "add") {
        if (!roles.some((r: any) => typeof r?.role_name === "string" && r.role_name.trim() === name)) {
          roles.push({ role_name: name, appearance_time_point: "", location_info: "", action: "", expression: "", speak: "" })
        }
        if (!vcRoles.some((r: any) => typeof r?.role_name === "string" && r.role_name.trim() === name)) {
          vcRoles.push({ role_name: name, description: "" })
        }
        nextShotContent.roles = roles
        nextVideoContent.roles = vcRoles
      } else {
        nextShotContent.roles = roles.filter((r: any) => !(typeof r?.role_name === "string" && r.role_name.trim() === name))
        nextVideoContent.roles = vcRoles.filter((r: any) => !(typeof r?.role_name === "string" && r.role_name.trim() === name))
      }
    } else {
      const roleItems = (Array.isArray(nextShotContent.role_items) ? nextShotContent.role_items.slice() : []) as any[]
      const otherItems = (Array.isArray(nextShotContent.other_items) ? nextShotContent.other_items.slice() : []) as any[]
      const vcItems = (Array.isArray(nextVideoContent.items) ? nextVideoContent.items.slice() : []) as any[]
      const vcOther = (Array.isArray(nextVideoContent.other_items) ? nextVideoContent.other_items.slice() : []) as any[]
      if (op === "add") {
        if (!otherItems.some((v: any) => typeof v === "string" && v.trim() === name)) otherItems.push(name)
        if (!vcItems.some((r: any) => typeof r?.item_name === "string" && r.item_name.trim() === name)) vcItems.push({ item_name: name, description: "" })
        nextShotContent.other_items = otherItems
        nextVideoContent.items = vcItems
      } else {
        nextShotContent.role_items = roleItems.filter((v: any) => !(typeof v === "string" && v.trim() === name))
        nextShotContent.other_items = otherItems.filter((v: any) => !(typeof v === "string" && v.trim() === name))
        nextVideoContent.items = vcItems.filter((r: any) => !(typeof r?.item_name === "string" && r.item_name.trim() === name))
        nextVideoContent.other_items = vcOther.filter((r: any) => !(typeof r?.item_name === "string" && r.item_name.trim() === name))
      }
    }

    return { ...current, shot_content: nextShotContent, video_content: nextVideoContent }
  }, [])

  const applyScriptPatch = useCallback(
    async (p: { storyboardId: string; op: "add" | "remove"; category: "role" | "item"; name: string }) => {
      const it = items.find((x) => x.id === p.storyboardId) as any
      if (!it) return
      const next = computeNextScriptContent(it, p.op, p.category, p.name)
      await persistStoryboardScriptContent(p.storyboardId, next)
      setItems((prev) =>
        prev.map((x) => {
          if (x.id !== p.storyboardId) return x
          const shotContent = (next as any)?.shot_content ?? (x as any).shot_content
          return { ...(x as any), scriptContent: next as any, shot_content: shotContent } as any
        })
      )
    },
    [computeNextScriptContent, items, persistStoryboardScriptContent, setItems]
  )

  const handleDeleteAsset = useCallback(
    async (p: { category: "role" | "item"; name: string; imageId?: string; isGlobal?: boolean }) => {
      const storyboardId = activeStoryboardId
      const name = (p.name ?? "").trim()
      if (!storyboardId || !name) return
      if (p.category === "role") setRoles((prev) => prev.filter((n) => n !== name))
      if (p.category === "item") setRoleItems((prev) => prev.filter((n) => n !== name))
      await applyScriptPatch({ storyboardId, op: "remove", category: p.category, name })
      if (p.imageId && !p.isGlobal) {
        const res = await fetch(`/api/video-creation/images/${encodeURIComponent(p.imageId)}`, { method: "DELETE" })
        const json = (await res.json().catch(() => null)) as { ok: boolean; error?: { message?: string } } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("video_reference_images_updated", { detail: { storyboardId } }))
      }
    },
    [activeStoryboardId, applyScriptPatch, setRoleItems, setRoles]
  )

  if (isLoading) return <div className={shellStyles.shell}>加载中…</div>
  if (loadError) return <div className={shellStyles.shell}>{loadError}</div>

  const videoSidebarProps =
    activeTab === "video"
      ? {
          prompt: videoPrompt,
          setPrompt: setVideoPrompt,
          storyboardMode,
          setStoryboardMode,
          durationSeconds,
          setDurationSeconds,
          hasVoice,
          setHasVoice,
          isGenerating: isGeneratingVideo,
          requestStatus: videoRequest.status,
          requestError: videoRequest.status === "error" ? videoRequest.error?.message ?? null : null,
          requestTraceId: videoRequest.traceId ?? null,
          storyboardId: activeStoryboardId,
          dialogues,
          onAudioGenerated: () => setTtsAudioVersion((v) => v + 1),
          onGenerate: handleGenerateVideo
        }
      : null

  return (
    <div className={shellStyles.shell} aria-label="生图/生视频工作台">
      {videoSidebarProps ? (
        <VideoParamsDrawer open={videoParamsOpen} onClose={() => setVideoParamsOpen(false)}>
          <VideoParamsSidebar {...videoSidebarProps} variant="drawer" />
        </VideoParamsDrawer>
      ) : null}
      {preview ? (
        <ImagePreviewModal
          key={`${preview.storyboardId ?? activeStoryboardId}:${preview.generatedImageId ?? preview.imageSrc}:${preview.frameKind ?? ""}`}
          open
          title={preview.title}
          imageSrc={preview.imageSrc}
          generatedImageId={preview.generatedImageId}
          storyId={storyId ?? null}
          storyboardId={preview.storyboardId ?? activeStoryboardId}
          category={preview.category ?? null}
          frameKind={preview.frameKind ?? null}
          description={preview.description ?? null}
          prompt={preview.prompt ?? null}
          onStoryboardFrameUpdated={(p: { storyboardId: string; frameKind: "first" | "last"; url: string; thumbnailUrl: string | null }) => {
            const { storyboardId, frameKind, url, thumbnailUrl } = p
            if (!storyboardId) return
            if (frameKind === "first") setPreviewImageSrcById((prev) => ({ ...prev, [storyboardId]: url }))
            setItems((prev) =>
              prev.map((it) => {
                if (it.id !== storyboardId) return it
                const baseFrames = it.frames ?? {}
                const patch =
                  frameKind === "first"
                    ? { first: { ...(baseFrames.first ?? {}), url, thumbnailUrl } }
                    : { last: { ...(baseFrames.last ?? {}), url, thumbnailUrl } }
                return { ...it, frames: { ...baseFrames, ...patch } as any }
              })
            )
          }}
          onClose={() => setPreview(null)}
        />
      ) : null}
      <CreateWorkspaceMain
        onBack={handleBack}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        episodeLabel={episodeLabel}
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
        mobileActions={
          activeTab === "video" ? (
            <button type="button" onClick={() => setVideoParamsOpen(true)}>
              参数
            </button>
          ) : null
        }
        leftPanel={
          activeTab === "image" ? (
            <ImageParamsSidebar
              key={`image-sidebar-${activeStoryboardId}`}
              prompt={imagePrompt}
              setPrompt={setImagePrompt}
              tailPrompt={lastImagePrompt}
              setTailPrompt={setLastImagePrompt}
              isGenerating={isGeneratingImage}
              requestStatus={imageRequest.status}
              requestError={imageRequest.status === "error" ? imageRequest.error?.message ?? null : null}
              requestTraceId={imageRequest.traceId ?? null}
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
              onPreviewImage={(title, imageSrc, generatedImageId, storyboardId, category, description, prompt) =>
                setPreview({ title, imageSrc, generatedImageId, storyboardId: storyboardId ?? activeStoryboardId, category, description, prompt })
              }
              previews={activePreviews}
              onOpenAddModal={(kind) => setAddModal({ open: true, kind })}
              onDeleteAsset={handleDeleteAsset}
            />
          ) : (
            (videoSidebarProps ? <VideoParamsSidebar {...videoSidebarProps} /> : <div />)
          )
        }
        rightPanel={
          <MediaPreviewPanel
            mode={activeTab}
            activeImageSrc={activePreview?.imageSrc ?? ""}
            activeFrameImages={activeTab === "image" ? activeFrameImages : undefined}
            activeTitle={activePreview?.title ?? ""}
            thumbnails={thumbnails}
            episodeThumbnailRows={episodeThumbnails}
            activeId={activeStoryboardId || thumbnails[0]?.id || ""}
            onEpisodeThumbnailClick={({ outlineId: targetOutlineId, storyboardId: targetStoryboardId }) => {
              const sid = (storyId ?? "").trim()
              if (!sid) return
              const oid = (targetOutlineId ?? "").trim()
              const tid = (targetStoryboardId ?? "").trim()
              if (!oid || !tid) return
              setActiveStoryboardId(tid)
              if ((outlineId ?? "").trim() !== oid) {
                const qs = new URLSearchParams({ storyId: sid, outlineId: oid, storyboardId: tid, sceneNo: "1" })
                router.replace(`/video/image?${qs.toString()}`)
                return
              }
            }}
            onOpenFrameImage={openFrameImagePreview}
            timelineSegments={timelineSegments}
            videoAssetGroups={activeTab === "video" ? videoAssetGroups : undefined}
            timelineKey={storyId ?? "no-story"}
            storyId={storyId ?? undefined}
            initialTimeline={timelineDraft}
            onTimelineChange={handleTimelineChange}
            storyboardId={activeStoryboardId}
            ttsAudioVersion={ttsAudioVersion}
            onThumbnailClick={(id) => {
              if (id === activeStoryboardId) return
              setActiveStoryboardId(id)
            }}
          />
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
          if (addModal.kind === "role") {
            setRoles((p) => uniqueStrings([...p, trimmed]))
            void applyScriptPatch({ storyboardId: activeStoryboardId, op: "add", category: "role", name: trimmed })
          }
          if (addModal.kind === "item") {
            setRoleItems((p) => uniqueStrings([...p, trimmed]))
            void applyScriptPatch({ storyboardId: activeStoryboardId, op: "add", category: "item", name: trimmed })
          }
          if (addModal.kind === "background") setSceneText(trimmed)
          setAddModal((p) => ({ ...p, open: false }))
        }}
      />
    </div>
  )
}
