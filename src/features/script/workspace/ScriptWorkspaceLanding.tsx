"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReactElement } from "react"
import Link from "next/link"
import { logger } from "@/shared/logger"
import type { ScriptStartMode } from "./components/ScriptCreationDialog"
import { ScriptCreationDialog } from "./components/ScriptCreationDialog"
import workspaceStyles from "./ScriptWorkspacePage.module.css"
import outlineNavStyles from "./components/OutlineNav.module.css"
import previewPanelStyles from "./components/PreviewPanel.module.css"
import chatSidebarStyles from "./components/ChatSidebar.module.css"
import styles from "./ScriptWorkspaceLanding.module.css"

type ScriptWorkspaceLandingProps = {
  entry?: string
  mode: ScriptStartMode
}

export function ScriptWorkspaceLanding({ entry, mode }: ScriptWorkspaceLandingProps): ReactElement {
  const isNavEntry = entry === "nav"
  const [dialogMode, setDialogMode] = useState<ScriptStartMode>(mode)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isNavEntry) return
    logger.info({
      event: "script_workspace_entry_view",
      module: "script",
      traceId: "client",
      message: "进入剧本工作台入口态",
      entry
    })
  }, [entry, isNavEntry])

  const openDialog = useCallback(
    (m: ScriptStartMode) => {
      setDialogMode(m)
      setOpen(true)
      logger.info({
        event: "script_workspace_entry_create_click",
        module: "script",
        traceId: "client",
        message: "点击入口新建卡片",
        mode: m,
        entry
      })
    },
    [entry]
  )

  return (
    <main className={workspaceStyles.main}>
      <section className={workspaceStyles.grid}>
        <nav className={outlineNavStyles.outlineNav} aria-label="选择剧本大纲章节">
          <div className={outlineNavStyles.outlineNavHeader}>
            <div className={outlineNavStyles.outlineNavTitle}>大纲章节</div>
            <div className={outlineNavStyles.outlineNavHint}>生成后可在此选择章节</div>
          </div>
          <div className={outlineNavStyles.outlineNavList}>
            <div className={styles.placeholder}>暂无章节</div>
          </div>
        </nav>

        <section className={previewPanelStyles.preview}>
          <div className={previewPanelStyles.previewHeader}>
            <div className={previewPanelStyles.previewTitle}>预览区</div>
            <div className={previewPanelStyles.previewActions}>
              <div className={previewPanelStyles.previewHint}>新建并生成大纲后展示内容</div>
            </div>
          </div>
          <article className={previewPanelStyles.markdown}>
            <div className={previewPanelStyles.originalEmpty}>请先在右侧新建剧本并生成大纲</div>
          </article>
          <div className={previewPanelStyles.nextStep}>
            <div className={previewPanelStyles.nextStepCard}>
              <div className={previewPanelStyles.nextStepText}>
                <div className={previewPanelStyles.nextStepTitle}>下一步：生成分镜文本</div>
                <div className={previewPanelStyles.nextStepDesc}>生成大纲后才可继续生成分镜文本。</div>
              </div>
            </div>
          </div>
        </section>

        <aside className={chatSidebarStyles.sidebar}>
          <div className={chatSidebarStyles.sidebarHeader}>
            <div className={chatSidebarStyles.sidebarTitle}>剧本创作</div>
            <div className={chatSidebarStyles.sidebarActions}>
              <Link href="/library" className={chatSidebarStyles.backLink}>
                去内容库
              </Link>
            </div>
          </div>

          <div className={chatSidebarStyles.thread}>
            {isNavEntry ? (
              <div className={styles.cards} aria-label="新建剧本">
                <button type="button" className={`${styles.card} ${styles.cardPrimary}`} onClick={() => openDialog("source")}>
                  <div className={styles.cardTitle}>从故事原文开始</div>
                  <div className={styles.cardDesc}>适合：小说片段、软文、口播稿、改写素材</div>
                </button>
                <button type="button" className={styles.card} onClick={() => openDialog("brief")}>
                  <div className={styles.cardTitle}>从剧情简介开始</div>
                  <div className={styles.cardDesc}>适合：一句话 idea、短视频设定、营销方向</div>
                </button>
                <div className={styles.hint}>选择一种方式开始创作，生成后可在左侧查看章节，在右侧继续改写。</div>
              </div>
            ) : (
              <div className={styles.placeholder}>请从内容库选择剧本，或点击右上角“+ 新建”。</div>
            )}
          </div>

          <div className={`${chatSidebarStyles.composer} ${styles.disabledComposer}`}>
            <div className={chatSidebarStyles.composerBlock}>
              <div className={chatSidebarStyles.composerRow}>
                <textarea className={chatSidebarStyles.textarea} placeholder="生成大纲后可在此输入改写需求…" rows={2} disabled />
                <button type="button" className={chatSidebarStyles.sendButton} disabled>
                  改写
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <ScriptCreationDialog
        key={dialogMode}
        open={open}
        onClose={() => setOpen(false)}
        initialMode={dialogMode}
      />
    </main>
  )
}
