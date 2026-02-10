"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import type { ChatMessage, TvcPhaseId } from "@/features/tvc/types"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import { useTvcTelemetry } from "@/features/tvc/workspace/hooks/useTvcTelemetry"
import { useTvcAssetResolver } from "@/features/tvc/workspace/hooks/useTvcAssetResolver"
import { useTvcShotsPreview } from "@/features/tvc/workspace/hooks/useTvcShotsPreview"
import { useTvcMediaPreview } from "@/features/tvc/workspace/hooks/useTvcMediaPreview"
import { useTvcAssetDrivenStepsFromAssets } from "@/features/tvc/workspace/hooks/useTvcAssetDrivenStepsFromAssets"
import { TvcWorkspaceView } from "@/features/tvc/workspace/TvcWorkspaceView"
import { useTvcProject } from "@/features/tvc/workspace/hooks/useTvcProject"
import { tvcPhaseLabelById } from "@/features/tvc/workspace/constants"
import { useClarification } from "@/features/tvc/clarification"
import { useTvcWorkspaceUiState } from "@/features/tvc/workspace/hooks/useTvcWorkspaceUiState"
import { useTvcTaskQueue } from "@/features/tvc/workspace/hooks/useTvcTaskQueue"
import { useTvcCreationHydration } from "@/features/tvc/workspace/hooks/useTvcCreationHydration"
import { useTvcAssetsSubscription } from "@/features/tvc/workspace/hooks/useTvcAssetsSubscription"
import { useTvcShotlistFlow } from "@/features/tvc/workspace/hooks/useTvcShotlistFlow"
import { useTvcAssembleVideo } from "@/features/tvc/workspace/hooks/useTvcAssembleVideo"
import { useTvcTimelineDraft } from "@/features/tvc/workspace/hooks/useTvcTimelineDraft"
import { useTvcProjectAssets } from "@/features/tvc/workspace/hooks/useTvcProjectAssets"
import { useTvcPreviewAllState } from "@/features/tvc/workspace/hooks/useTvcPreviewAllState"
import type { TimelineSegment } from "@/shared/utils/mediaPreviewUtils"

export function TvcWorkspacePage(): ReactElement {
  const { isCompact, activePhase, setActivePhase, activeTab, setActiveTab, chatFocusToken, setChatFocusToken, chatDrawerOpen, setChatDrawerOpen, activeDock, setActiveDock } =
    useTvcWorkspaceUiState()
  const { projectId, projectError, setProjectError, isCreatingProject, finalVideoUrl, brief, setBrief, durationSec, setDurationSec, refreshProject, createNewProject } = useTvcProject()
  const [agentPhaseById, setAgentPhaseById] = useState<Partial<Record<TvcPhaseId, TvcAgentStep>>>({})
  const [initialChatMessages, setInitialChatMessages] = useState<ChatMessage[] | null>(null)
  const [userProvidedImages, setUserProvidedImages] = useState<Array<{ ordinal: number; url: string; thumbnailUrl?: string }>>([])
  const { clarification, onClarification, reset: resetClarification, hydrate: hydrateClarification } = useClarification()
  const { assetUrlByKey, setAssetUrlByKey } = useTvcAssetResolver({ projectId, agentStepByCanvasId: agentPhaseById })
  const { notifyAssets: notifyAssetDrivenSteps } = useTvcAssetDrivenStepsFromAssets({ assetUrlByKey, setAgentPhaseById })
  const sendTelemetry = useTvcTelemetry()
  const { taskQueue, onAgentTask, externalSend, externalDraft, requestChatSend, requestChatDraft } = useTvcTaskQueue({ assetUrlByKey, resetClarification })
  const { shots, setShots, shotlistLoading, isGeneratingShotlist, handleGenerateShotlist } = useTvcShotlistFlow({ projectId, brief, durationSec, setProjectError, sendTelemetry })

  useTvcCreationHydration({
    projectId,
    clarificationText: String(clarification?.text ?? ""),
    hydrateClarification: hydrateClarification,
    notifyAssetDrivenSteps,
    setUserProvidedImages,
    setAssetUrlByKey,
    setInitialChatMessages
  })

  useTvcAssetsSubscription({
    projectId,
    clarificationText: String(clarification?.text ?? ""),
    hydrateClarification,
    notifyAssetDrivenSteps,
    setAgentPhaseById,
    setUserProvidedImages,
    setAssetUrlByKey
  })

  const { displayShots, activeShot, selectedShotId, setSelectedShotId } = useTvcShotsPreview({ shots, agentStepByCanvasId: agentPhaseById, assetUrlByKey })
  const { previewImages, previewVideos } = useTvcMediaPreview({ agentStepByCanvasId: agentPhaseById, assetUrlByKey })
  const { timelineDraft, queueSaveTimeline } = useTvcTimelineDraft(projectId)
  const { items: projectAssets } = useTvcProjectAssets(projectId)
  const videoClipByOrdinal = useMemo(() => {
    const out: Record<number, { url: string; durationSeconds?: number }> = {}
    for (const a of projectAssets) {
      if (a.kind !== "video_clip") continue
      const url = String((a.meta as any)?.url ?? "").trim()
      if (!url) continue
      const ordinal = Number(a.ordinal ?? 0)
      if (!Number.isFinite(ordinal) || ordinal <= 0) continue
      const durationSecondsRaw = Number((a.meta as any)?.durationSeconds ?? 0)
      const durationSeconds = Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0 ? durationSecondsRaw : undefined
      out[ordinal] = durationSeconds ? { url, durationSeconds } : { url }
    }
    return out
  }, [projectAssets])

  const { assembleVideo, isAssemblingVideo } = useTvcAssembleVideo({ projectId, displayShots, videoClipByOrdinal, timelineDraft, refreshProject, setProjectError })
  const firstFrameUrlByOrdinal = useMemo(() => {
    const out: Record<number, string> = {}
    for (const a of projectAssets) {
      if (a.kind !== "first_frame") continue
      const url = String(a.url ?? a.thumbnailUrl ?? "").trim()
      if (!url) continue
      const ordinal = Number(a.ordinal ?? 0)
      if (!Number.isFinite(ordinal) || ordinal <= 0) continue
      out[ordinal] = url
    }
    return out
  }, [projectAssets])

  const previewAllSegments = useMemo((): TimelineSegment[] => {
    return displayShots
      .slice()
      .sort((a, b) => (Number(a.sequence ?? 0) || 0) - (Number(b.sequence ?? 0) || 0))
      .map((s) => {
        const seq = Number(s.sequence ?? 0)
        const asset = Number.isFinite(seq) && seq > 0 ? videoClipByOrdinal?.[seq] ?? null : null
        const videoSrc = String(asset?.url ?? "").trim() || null
        const durationSecondsRaw = Number(asset?.durationSeconds ?? (s.scriptContent as any)?.["时长"] ?? 0)
        const durationSeconds = Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0 ? durationSecondsRaw : null
        return { id: s.id, title: `Shot ${String(s.sequence).padStart(2, "0")}`, videoSrc, durationSeconds }
      })
  }, [displayShots, videoClipByOrdinal])

  const previewAll = useTvcPreviewAllState({ segments: previewAllSegments, timelineDraft })

  const createNewProjectNoArg = async () => {
    await createNewProject({
      onReset: () => {
        setAgentPhaseById({})
        setInitialChatMessages(null)
        setShots([])
        setSelectedShotId(null)
        setAssetUrlByKey({})
        resetClarification()
        setActiveDock("board")
        setActivePhase("clarification")
        setActiveTab("shotlist")
      }
    })
  }

  const deleteAsset = async (args: { kind: "reference_image" | "first_frame" | "video_clip"; ordinal: number }) => {
    if (!projectId) return
    setProjectError(null)
    const res = await fetch(`/api/tvc/projects/${encodeURIComponent(projectId)}/assets`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: args.kind, ordinal: args.ordinal })
    }).catch(() => null)

    const json = res ? ((await res.json().catch(() => null)) as any) : null
    if (!res || !res.ok || !json?.ok) {
      const msg = String(json?.error?.message ?? "删除失败")
      setProjectError(msg)
      return
    }

    setAssetUrlByKey((prev) => {
      const next = { ...prev }
      const baseKey = `${args.kind}:${args.ordinal}`
      if (baseKey in next) delete next[baseKey]
      const origKey = `${baseKey}:orig`
      if (origKey in next) delete next[origKey]
      return next
    })

    setAgentPhaseById((prev) => {
      if (args.kind === "video_clip") {
        const step = prev.video_clip
        const list = Array.isArray(step?.content?.videoClips) ? step!.content.videoClips! : []
        const nextList = list.filter((row) => {
          const rec = row as any
          const n = Number.parseInt(String(rec?.ordinal ?? rec?.index ?? "").replace(/[^\d]/g, ""), 10)
          return Number.isFinite(n) ? n !== args.ordinal : true
        })
        if (nextList.length === list.length) return prev
        return { ...prev, video_clip: { ...(step as any), content: { ...(step?.content ?? {}), videoClips: nextList } } }
      }

      const stepId = args.kind === "reference_image" ? "reference_image" : "first_frame"
      const step = (prev as any)[stepId] as TvcAgentStep | undefined
      const list = Array.isArray(step?.content?.images) ? (step!.content.images as any[]) : []
      const nextList = list.filter((img) => {
        const rec = img as any
        const n = Number.parseInt(String(rec?.ordinal ?? rec?.index ?? "").replace(/[^\d]/g, ""), 10)
        return Number.isFinite(n) ? n !== args.ordinal : true
      })
      if (nextList.length === list.length) return prev
      return { ...prev, [stepId]: { ...(step as any), content: { ...(step?.content ?? {}), images: nextList } } }
    })

    sendTelemetry("tvc_asset_deleted", { kind: args.kind, ordinal: args.ordinal })
  }

  const canAssemble = Object.keys(videoClipByOrdinal).length > 0 && !isAssemblingVideo

  useEffect(() => {
    sendTelemetry("tvc_open", { referrer: document.referrer || null, userAgent: navigator.userAgent })
  }, [sendTelemetry])

  return (
    <TvcWorkspaceView
      projectError={projectError}
      projectId={projectId}
      isCreatingProject={isCreatingProject}
      createNewProject={createNewProjectNoArg}
      activePhase={activePhase}
      setActivePhase={setActivePhase}
      phaseLabelById={tvcPhaseLabelById}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      activeDock={activeDock}
      setActiveDock={setActiveDock}
      chatDrawerOpen={chatDrawerOpen}
      setChatDrawerOpen={setChatDrawerOpen}
      setChatFocusToken={setChatFocusToken}
      chatFocusToken={chatFocusToken}
      isCompact={isCompact}
      isGeneratingShotlist={isGeneratingShotlist}
      handleGenerateShotlist={handleGenerateShotlist}
      brief={brief}
      setBrief={setBrief}
      durationSec={durationSec}
      setDurationSec={setDurationSec}
      agentPhaseById={agentPhaseById}
      setAgentPhaseById={setAgentPhaseById}
      assetUrlByKey={assetUrlByKey}
      displayShots={displayShots}
      shotlistLoading={shotlistLoading}
      previewImages={previewImages}
      previewVideos={previewVideos}
      firstFrameUrlByOrdinal={firstFrameUrlByOrdinal}
      videoClipByOrdinal={videoClipByOrdinal}
      previewAll={previewAll}
      activeShot={activeShot}
      finalVideoUrl={finalVideoUrl}
      assembleVideo={assembleVideo}
      isAssemblingVideo={isAssemblingVideo}
      canAssemble={canAssemble}
      initialChatMessages={initialChatMessages}
      selectedShotId={selectedShotId}
      setSelectedShotId={setSelectedShotId}
      timelineDraft={timelineDraft}
      onTimelineChange={queueSaveTimeline}
      sendTelemetry={sendTelemetry}
      userProvidedImages={userProvidedImages}
      externalSend={externalSend}
      externalDraft={externalDraft}
      requestChatSend={requestChatSend}
      requestChatDraft={requestChatDraft}
      onAssetDelete={deleteAsset}
      taskQueue={taskQueue}
      onAgentTask={onAgentTask}
      clarification={clarification}
      onClarification={onClarification}
      onClarificationReset={resetClarification}
    />
  )
}
