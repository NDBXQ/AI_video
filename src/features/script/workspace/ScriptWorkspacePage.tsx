
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import styles from "./ScriptWorkspacePage.module.css"
import type { ScriptWorkspaceMode, OutlineItem } from "./utils"
import { OutlineNav } from "./components/OutlineNav"
import { PreviewPanel } from "./components/PreviewPanel"
import { ChatSidebar } from "./components/ChatSidebar"
import { WorkspaceResizeHandle } from "./components/WorkspaceResizeHandle"
import { useOutlineActions } from "./hooks/useOutlineActions"
import { useScriptRewrite } from "./hooks/useScriptRewrite"

type ScriptWorkspacePageProps = Readonly<{
  mode: ScriptWorkspaceMode
  storyId: string
  outline?: string
  outlines: ReadonlyArray<OutlineItem>
  storyMetadata?: Record<string, unknown>
}>

/**
 * 剧本创作工作区页面（与参考图保持结构一致）
 * @param {ScriptWorkspacePageProps} props - 组件属性
 * @param {ScriptWorkspaceMode} props.mode - 进入模式（source/brief）
 * @param {string} props.storyId - 故事 ID
 * @returns {ReactElement} 页面内容
 */
export function ScriptWorkspacePage({ mode, storyId, outline, outlines, storyMetadata }: ScriptWorkspacePageProps): ReactElement {
  const router = useRouter()
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const outlineIndex = (() => {
    const parsed = Number(outline)
    if (!Number.isFinite(parsed)) return 1
    if (parsed < 1) return 1
    return Math.trunc(parsed)
  })()

  const [localOutlines, setLocalOutlines] = useState<ReadonlyArray<OutlineItem>>(() => outlines.slice())

  useEffect(() => {
    setLocalOutlines(outlines.slice())
  }, [outlines])

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)")
    const sync = () => setIsCompact(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!isCompact) setChatOpen(false)
  }, [isCompact])

  const activeOutline = localOutlines.find((o) => o.sequence === outlineIndex) ?? localOutlines[0] ?? null

  const activeDraft = useMemo(() => {
    if (!activeOutline) return null
    const drafts = Array.isArray(activeOutline.outlineDrafts) ? activeOutline.outlineDrafts : []
    const activeId = (activeOutline.activeOutlineDraftId ?? "").trim()
    if (activeId) return drafts.find((d) => d.id === activeId) ?? drafts[drafts.length - 1] ?? null
    return drafts[drafts.length - 1] ?? null
  }, [activeOutline])

  const {
    deletingOutlineId,
    confirmDeleteOutlineId,
    setConfirmDeleteOutlineId,
    handleDeleteOutline,
    persistOutlineDraft,
    toast,
    setToast
  } = useOutlineActions(setLocalOutlines)

  const {
    rewriteRequirements,
    setRewriteRequirements,
    rewriteBySeq,
    rewriteMessages,
    previewMode,
    setPreviewMode,
    handleRewrite,
    isRewriteStreaming,
    activeRewrite,
    threadRef,
    shouldAutoScrollRef
  } = useScriptRewrite({ storyId, activeOutline, persistOutlineDraft, setToast })

  const hasPersistedRewrite = Boolean(activeDraft?.content?.trim())
  const canShowRewrite = Boolean(
    hasPersistedRewrite || (activeRewrite && (activeRewrite.status === "streaming" || activeRewrite.status === "done"))
  )

  const [generatingStoryboard, setGeneratingStoryboard] = useState(false)
  const [shortDrama, setShortDrama] = useState<any>(() => (storyMetadata as any)?.shortDrama ?? null)

  useEffect(() => {
    setShortDrama((storyMetadata as any)?.shortDrama ?? null)
  }, [storyId, storyMetadata])

  const handleGenerateStoryboardText = useCallback(async () => {
    if (!activeOutline) return
    if (generatingStoryboard) return
    setGeneratingStoryboard(true)
    try {
      const outlineId = activeOutline.outlineId
      router.push(
        `/video?tab=list&storyId=${encodeURIComponent(storyId)}&outlineId=${encodeURIComponent(outlineId)}&autoGenerate=true`
      )
    } catch (e) {
      const anyErr = e as { message?: string }
      setToast({ type: "error", message: anyErr?.message ?? "生成失败，请稍后重试" })
    } finally {
      setGeneratingStoryboard(false)
    }
  }, [activeOutline, generatingStoryboard, router, storyId, setToast])

  const handleManualGenerate = useCallback(() => {
    if (!activeOutline) return
    router.push(`/video?tab=list&storyId=${encodeURIComponent(storyId)}&autoGenerate=script`)
  }, [activeOutline, router, storyId])

  return (
    <main className={styles.main}>
      <section className={styles.gridFrame}>
        <div className={isCompact ? `${styles.grid} ${styles.gridCompact}` : styles.grid} ref={gridRef}>
          <OutlineNav
            outlines={localOutlines}
            activeOutline={activeOutline}
            rewriteBySeq={rewriteBySeq}
            storyId={storyId}
            mode={mode}
            deletingOutlineId={deletingOutlineId}
            setConfirmDeleteOutlineId={setConfirmDeleteOutlineId}
          />

          <PreviewPanel
            activeOutline={activeOutline}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            canShowRewrite={canShowRewrite}
            activeRewrite={activeRewrite}
            activeDraft={activeDraft}
            generatingStoryboard={generatingStoryboard}
            handleGenerateStoryboardText={handleGenerateStoryboardText}
            handleManualGenerate={handleManualGenerate}
            storyId={storyId}
            shortDrama={shortDrama}
            onShortDramaUpdate={setShortDrama}
          />

          {!isCompact ? <WorkspaceResizeHandle containerRef={gridRef} /> : null}

          {!isCompact ? (
            <ChatSidebar
              rewriteMessages={rewriteMessages}
              rewriteRequirements={rewriteRequirements}
              setRewriteRequirements={setRewriteRequirements}
              handleRewrite={handleRewrite}
              activeOutline={activeOutline}
              isRewriteStreaming={isRewriteStreaming}
              toast={toast}
              threadRef={threadRef}
              onScrollThread={() => {
                const el = threadRef.current
                if (!el) return
                const threshold = 24
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
                shouldAutoScrollRef.current = atBottom
              }}
            />
          ) : (
            <div className={styles.chatPlaceholder} aria-hidden="true" />
          )}
        </div>
      </section>

      {isCompact ? (
        <>
          <button type="button" className={styles.chatFab} onClick={() => setChatOpen(true)}>
            对话
          </button>
          {chatOpen ? (
            <div
              className={styles.drawerBackdrop}
              role="dialog"
              aria-modal="true"
              aria-label="对话助手"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setChatOpen(false)
              }}
            >
              <div className={`${styles.drawer} ${styles.drawerRight}`}>
                <ChatSidebar
                  variant="drawer"
                  onClose={() => setChatOpen(false)}
                  rewriteMessages={rewriteMessages}
                  rewriteRequirements={rewriteRequirements}
                  setRewriteRequirements={setRewriteRequirements}
                  handleRewrite={handleRewrite}
                  activeOutline={activeOutline}
                  isRewriteStreaming={isRewriteStreaming}
                  toast={toast}
                  threadRef={threadRef}
                  onScrollThread={() => {
                    const el = threadRef.current
                    if (!el) return
                    const threshold = 24
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
                    shouldAutoScrollRef.current = atBottom
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {confirmDeleteOutlineId ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="确认删除"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteOutlineId(null)
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalTitle}>删除该章节？</div>
            <div className={styles.modalDesc}>将同时删除该章节的原文与分镜数据，且无法恢复。</div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalButton}
                onClick={() => setConfirmDeleteOutlineId(null)}
                disabled={Boolean(deletingOutlineId)}
              >
                取消
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonDanger}`}
                onClick={() => {
                  const id = confirmDeleteOutlineId
                  setConfirmDeleteOutlineId(null)
                  void handleDeleteOutline(id)
                }}
                disabled={Boolean(deletingOutlineId)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
