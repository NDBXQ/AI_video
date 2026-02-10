"use client"

import Link from "next/link"
import { ArrowLeft, LayoutGrid, ListChecks, MessageSquare, Plus } from "lucide-react"
import { useEffect, useState, type ReactElement } from "react"
import styles from "../TvcWorkspacePage.module.css"
import type { ChatMessage, TvcPhaseId, TvcPreviewTab } from "@/features/tvc/types"
import { StyleVibePanel } from "@/features/tvc/components/StyleVibePanel"
import { TvcPreviewPanel } from "@/features/tvc/components/TvcPreviewPanel"
import type { TimelineShot } from "@/features/tvc/components/TvcTimelinePanel"
import { TvcVideoTimelineEditor } from "@/features/tvc/components/TvcVideoTimelineEditor"
import { TvcAssetSidebar } from "@/features/tvc/components/TvcAssetSidebar"
import { TvcChatPanel } from "@/features/tvc/components/TvcChatPanel"
import type { TvcAgentStep } from "@/features/tvc/agent/types"
import type { ClarificationEvent, ClarificationUiState } from "@/features/tvc/clarification"
import type { PreviewPlaylistItem, TimelineAudioClip, TimelineVideoClip } from "@/shared/utils/mediaPreviewUtils"

export type TvcAssetKind = "reference_image" | "first_frame" | "video_clip"

export type TvcUiTask = {
  id: string
  kind: TvcAssetKind
  title: string
  status: "queued" | "running" | "done" | "failed"
  createdAt: number
  targetOrdinal?: number
  message?: string
}

export type TvcWorkspaceViewProps = {
  projectError: string | null
  projectId: string
  isCreatingProject: boolean
  createNewProject: () => Promise<void>
  activePhase: TvcPhaseId
  setActivePhase: (id: TvcPhaseId) => void
  phaseLabelById: Record<TvcPhaseId, string>
  activeTab: TvcPreviewTab
  setActiveTab: (tab: TvcPreviewTab) => void
  activeDock: "edit" | "board"
  setActiveDock: (dock: "edit" | "board") => void
  chatDrawerOpen: boolean
  setChatDrawerOpen: (open: boolean) => void
  setChatFocusToken: (updater: (v: number) => number) => void
  chatFocusToken: number
  isCompact: boolean
  isGeneratingShotlist: boolean
  handleGenerateShotlist: () => void
  brief: string
  setBrief: (v: string) => void
  durationSec: number
  setDurationSec: (v: number) => void
  agentPhaseById: Partial<Record<TvcPhaseId, TvcAgentStep>>
  setAgentPhaseById: React.Dispatch<React.SetStateAction<Partial<Record<TvcPhaseId, TvcAgentStep>>>>
  assetUrlByKey: Record<string, string>
  displayShots: TimelineShot[]
  shotlistLoading: boolean
  previewImages: Array<{ url: string; category: string; name: string; description: string }>
  previewVideos: Array<{ url: string; title: string; duration: string }>
  firstFrameUrlByOrdinal: Record<number, string>
  videoClipByOrdinal: Record<number, { url: string; durationSeconds?: number }>
  previewAll: {
    previewAllActive: boolean
    previewAllPlaying: boolean
    previewAllSeeking: boolean
    hasAnyPlayableVideo: boolean
    currentItem: PreviewPlaylistItem | null
    currentItemDurationSeconds: number
    nextPreloadVideoSrc: string
    previewAllElapsedSeconds: number
    previewAllLocalTime: number
    timelineVideoClips: TimelineVideoClip[]
    timelineAudioClips: TimelineAudioClip[]
    playheadSeconds: number
    startPreviewAll: () => void
    stopPreviewAll: () => void
    togglePreviewAllPlaying: () => void
    advancePreviewAll: () => void
    updatePreviewAllLocalTime: (time: number) => void
    seekPlayheadSeconds: (seconds: number) => void
    onSeekStart: () => void
    onSeekEnd: () => void
  }
  activeShot: TimelineShot | null
  finalVideoUrl: string | null
  assembleVideo: () => Promise<void>
  isAssemblingVideo: boolean
  canAssemble: boolean
  initialChatMessages: ChatMessage[] | null
  selectedShotId: string | null
  setSelectedShotId: (id: string | null) => void
  timelineDraft: { videoClips: any[]; audioClips: any[] } | null
  onTimelineChange: (next: { videoClips: any[]; audioClips: any[] }) => void
  sendTelemetry: (event: string, payload: Record<string, unknown>) => void
  userProvidedImages: Array<{ ordinal: number; url: string; thumbnailUrl?: string }>
  externalSend: { id: string; text: string } | null
  externalDraft: { id: string; text: string } | null
  requestChatSend: (args: { text: string; kind?: TvcAssetKind; targetOrdinal?: number }) => void
  requestChatDraft: (text: string) => void
  onAssetDelete: (args: { kind: TvcAssetKind; ordinal: number }) => void
  taskQueue: TvcUiTask[]
  clarification: ClarificationUiState
  onClarification: (e: ClarificationEvent) => void
  onClarificationReset: () => void
  onAgentTask: (task: {
    id: string
    kind: TvcAssetKind
    state: "queued" | "running" | "done" | "failed"
    targetOrdinal?: number
    targetOrdinals?: number[]
    producedCount?: number
    message?: string
  }) => void
}

export function TvcWorkspaceView(props: TvcWorkspaceViewProps): ReactElement {
  const showBoard = props.activeDock === "board"
  const showEdit = props.activeDock === "edit"
  const showChat = showBoard
  const { setChatFocusToken } = props
  const [chatCollapsed, setChatCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    let t: number | null = null
    try {
      const next = window.localStorage.getItem("tvc_chat_collapsed") === "1"
      t = window.setTimeout(() => setChatCollapsed(next), 0)
    } catch {}
    return () => {
      if (t != null) window.clearTimeout(t)
    }
  }, [])

  const toggleChatCollapsed = () => {
    const next = !chatCollapsed
    setChatCollapsed(next)
    try {
      window.localStorage.setItem("tvc_chat_collapsed", next ? "1" : "0")
    } catch {}
    if (!next) setChatFocusToken((v) => v + 1)
  }

  const openChat = (mode: "send" | "draft") => {
    if (chatCollapsed) {
      setChatCollapsed(false)
      globalThis.localStorage?.setItem("tvc_chat_collapsed", "0")
    }
    props.setChatFocusToken((v) => v + 1)
    if (props.isCompact) props.setChatDrawerOpen(true)
    if (mode === "draft" && props.activeDock === "edit") props.setActiveDock("board")
  }

  return (
    <div className={styles.shell}>
      {props.projectError ? <div className={styles.toast}>{props.projectError}</div> : null}
      <div className={styles.workspace} aria-label="TVC 一键成片工作台">
        <header className={styles.topBar} aria-label="工作台主控条">
          <div className={styles.topLeft}>
            <Link className={styles.iconLink} href="/" aria-label="返回首页" title="返回首页">
              <ArrowLeft size={16} />
            </Link>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="新建 TVC 项目"
              title="新建项目"
              disabled={props.isCreatingProject}
              onClick={() => {
                void props.createNewProject()
              }}
            >
              <Plus size={16} />
            </button>
            <div className={styles.topTitle}>TVC 工作台</div>
            <div className={styles.topMeta}>
              {props.phaseLabelById[props.activePhase]} {props.projectId ? `· 项目 ${props.projectId.slice(0, 8)}` : ""}
            </div>
          </div>

          <div className={styles.topCenter}>
            <div className={styles.segmented} aria-label="视图切换">
              <button
                type="button"
                className={`${styles.segBtn} ${showBoard ? styles.segBtnActive : ""}`}
                onClick={() => props.setActiveDock("board")}
                aria-pressed={showBoard}
              >
                <LayoutGrid size={16} />
                工作流
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${showEdit ? styles.segBtnActive : ""}`}
                onClick={() => props.setActiveDock("edit")}
                aria-pressed={showEdit}
              >
                <ListChecks size={16} />
                预览与编辑
              </button>
            </div>
          </div>

          <div className={styles.topRight}>
            {showChat ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.desktopOnly}`}
                onClick={toggleChatCollapsed}
                aria-label={chatCollapsed ? "展开对话助手" : "收起对话助手"}
                aria-pressed={!chatCollapsed}
              >
                <MessageSquare size={16} />
                {chatCollapsed ? "展开对话" : "收起对话"}
              </button>
            ) : null}

            {null}

            {showChat ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.mobileOnly}`}
                onClick={() => {
                  props.setChatDrawerOpen(true)
                  props.setChatFocusToken((v) => v + 1)
                }}
                aria-label="打开对话助手"
              >
                <MessageSquare size={16} />
                对话
              </button>
            ) : null}
          </div>
        </header>

        <div className={`${styles.content} ${showChat && chatCollapsed ? styles.contentCollapsed : ""}`}>
          <section className={styles.mainPanel} aria-label="主画布">
            {showBoard ? (
              <div className={`${styles.panel} ${styles.boardPanel}`}>
                <StyleVibePanel
                  projectId={props.projectId}
                  activePhase={props.activePhase}
                  onPhaseChange={(id) => {
                    props.setActivePhase(id)
                    props.sendTelemetry("tvc_phase_changed", { phase: id })
                    if (id === "script" || id === "storyboard") props.setActiveTab("shotlist")
                    if (id === "reference_image" || id === "first_frame") props.setActiveTab("image")
                    if (id === "video_clip") props.setActiveTab("video")
                  }}
                  onOpenChat={() => {
                    props.setChatFocusToken((v) => v + 1)
                    if (props.isCompact) props.setChatDrawerOpen(true)
                  }}
                  onRequestSend={(text, meta) => {
                    openChat("send")
                    props.requestChatSend({ text, ...meta })
                  }}
                  onRequestDraft={(text) => {
                    openChat("draft")
                    props.requestChatDraft(text)
                  }}
                  onAssetDelete={props.onAssetDelete}
                  durationSec={props.durationSec}
                  agentPhaseById={props.agentPhaseById}
                  assetUrlByKey={props.assetUrlByKey}
                  userProvidedImages={props.userProvidedImages}
                  clarification={props.clarification}
                />
              </div>
            ) : showEdit ? (
              <div className={styles.centerPanel} aria-label="预览与时间线">
                <div className={styles.panel}>
                  <TvcPreviewPanel
                    activeTab={props.activeTab}
                    onTabChange={(tab) => {
                      props.setActiveTab(tab)
                      props.sendTelemetry("tvc_tab_changed", { tab })
                    }}
                    tasks={props.taskQueue}
                    onTaskAction={(action) => {
                      if (action.kind === "send") {
                        openChat("send")
                        props.requestChatSend({ text: action.text, ...(action.meta ?? {}) })
                      } else {
                        openChat("draft")
                        props.requestChatDraft(action.text)
                      }
                    }}
                    shots={props.displayShots}
                    isShotlistLoading={props.shotlistLoading || props.isGeneratingShotlist}
                    images={props.previewImages}
                    videos={props.previewVideos}
                    firstFrameUrlByOrdinal={props.firstFrameUrlByOrdinal}
                    videoClipByOrdinal={props.videoClipByOrdinal}
                    previewAll={props.previewAll}
                    activeShot={props.activeShot}
                    finalVideoUrl={props.finalVideoUrl}
                    onAssembleVideo={props.assembleVideo}
                    assemblingVideo={props.isAssemblingVideo}
                    canAssemble={props.canAssemble}
                  />
                </div>
                <div className={styles.panel}>
                  <TvcVideoTimelineEditor
                    projectId={props.projectId}
                    shots={props.displayShots}
                    videoClipByOrdinal={props.videoClipByOrdinal}
                    selectedShotId={props.selectedShotId}
                    onSelectShotId={props.setSelectedShotId}
                    initialTimeline={props.timelineDraft}
                    onTimelineChange={props.onTimelineChange}
                    playheadSeconds={props.previewAll.playheadSeconds}
                    playheadActive={true}
                    onSeekPlayheadSeconds={props.previewAll.seekPlayheadSeconds}
                    onSeekStart={props.previewAll.onSeekStart}
                    onSeekEnd={props.previewAll.onSeekEnd}
                  />
                </div>
              </div>
            ) : null}
          </section>

          {showEdit ? (
            <aside className={`${styles.panel} ${styles.rightPanel}`} aria-label="素材面板">
              <TvcAssetSidebar projectId={props.projectId} shots={props.displayShots} onSelectShotId={(id) => props.setSelectedShotId(id)} />
            </aside>
          ) : showChat ? (
            <aside className={`${styles.panel} ${styles.rightPanel} ${chatCollapsed ? styles.rightPanelCollapsed : ""}`} aria-label="对话助手">
              <TvcChatPanel
                key={`${props.projectId ?? "draft"}_side`}
                projectId={props.projectId}
                initialMessages={props.initialChatMessages ?? undefined}
                focusToken={props.chatFocusToken}
                externalSend={props.externalSend}
                externalDraft={props.externalDraft}
                onUserMessage={(text: string) => props.sendTelemetry("tvc_chat_submitted", { textLen: text.trim().length })}
                onScript={({ phase, markdown }) => {
                  props.setAgentPhaseById((prev) => {
                    const existing = prev.script
                    const current = String((existing?.content as any)?.scriptMarkdown ?? "")
                    const nextText = phase === "done" ? String(markdown ?? "") : `${current}${String(markdown ?? "")}`
                    if (!nextText.trim()) return prev
                    const existingStream = ((existing?.content as any)?.stream ?? {}) as any
                    const next: TvcAgentStep = {
                      id: "script",
                      title: existing?.title?.trim() ? existing.title : "剧情",
                      content: { ...(existing?.content ?? {}), scriptMarkdown: nextText, stream: { ...existingStream, scriptMarkdown: phase !== "done" } } as any
                    }
                    return { ...prev, script: next }
                  })
                }}
                onAgentTask={(task) => {
                  props.onAgentTask(task)
                }}
                onClarification={props.onClarification}
                onClarificationReset={props.onClarificationReset}
              />
            </aside>
          ) : null}

          {showChat && props.chatDrawerOpen ? (
            <>
              <button type="button" className={styles.drawerBackdrop} aria-label="关闭对话" onClick={() => props.setChatDrawerOpen(false)} />
              <div className={`${styles.drawer} ${styles.drawerRight}`} aria-label="对话抽屉">
                <div className={styles.panel}>
                  <TvcChatPanel
                    key={`${props.projectId ?? "draft"}_drawer`}
                    projectId={props.projectId}
                    initialMessages={props.initialChatMessages ?? undefined}
                    focusToken={props.chatFocusToken}
                    externalSend={props.externalSend}
                    externalDraft={props.externalDraft}
                    onUserMessage={(text: string) => props.sendTelemetry("tvc_chat_submitted", { textLen: text.trim().length })}
                    onScript={({ phase, markdown }) => {
                      props.setAgentPhaseById((prev) => {
                        const existing = prev.script
                        const current = String((existing?.content as any)?.scriptMarkdown ?? "")
                        const nextText = phase === "done" ? String(markdown ?? "") : `${current}${String(markdown ?? "")}`
                        if (!nextText.trim()) return prev
                        const existingStream = ((existing?.content as any)?.stream ?? {}) as any
                        const next: TvcAgentStep = {
                          id: "script",
                          title: existing?.title?.trim() ? existing.title : "剧情",
                          content: { ...(existing?.content ?? {}), scriptMarkdown: nextText, stream: { ...existingStream, scriptMarkdown: phase !== "done" } } as any
                        }
                        return { ...prev, script: next }
                      })
                    }}
                    onClarification={props.onClarification}
                    onClarificationReset={props.onClarificationReset}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
