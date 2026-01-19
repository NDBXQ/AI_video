"use client"

import Link from "next/link"
import type { MouseEvent, ReactElement } from "react"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "./ScriptCreationPage.module.css"
import { ScriptStartModal, type ScriptStartMode } from "./ScriptStartModal"

type ScriptCreationPageProps = Readonly<{
  initialMode?: ScriptStartMode
}>

/**
 * 剧本创作页面
 * @returns {ReactElement} 页面内容
 */
export function ScriptCreationPage({ initialMode }: ScriptCreationPageProps): ReactElement {
  const router = useRouter()
  const [mode, setMode] = useState<ScriptStartMode | null>(initialMode ?? null)

  const closeModal = useCallback(() => setMode(null), [])

  const onConfirm = useCallback(
    (_payload: { storyId: string; title: string; ratio: string; resolution: string; content: string }) => {
      const m = mode ?? "brief"
      closeModal()
      router.push(`/script/workspace/${encodeURIComponent(_payload.storyId)}?mode=${m}`)
    },
    [closeModal, mode, router]
  )

  const onOpenSource = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      setMode("source")
    },
    []
  )

  const onOpenBrief = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      setMode("brief")
    },
    []
  )

  return (
    <main className={styles.main}>
      <section className={styles.heroCard}>
        <div className={styles.heroLeft}>
          <div className={styles.tag}>
            <span className={styles.tagIcon} aria-hidden="true" />
            AI 智能剧本创作
          </div>
          <h1 className={styles.title}>剧本创作</h1>
          <p className={styles.subtitle}>
            先生成结构化故事大纲，再生成分镜场景文本。整体流程更清晰，产出更稳定。
          </p>
          <div className={styles.chips} aria-label="能力特性">
            <span className={styles.chip}>两步完成</span>
            <span className={styles.chip}>自动保存</span>
            <span className={styles.chip}>可继续编辑</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href="/script" onClick={onOpenSource}>
            从故事原文开始
          </Link>
          <Link className={styles.secondaryAction} href="/script" onClick={onOpenBrief}>
            从剧情简介开始
          </Link>
          <Link className={styles.inlineLink} href="/library">
            去内容库继续创作 →
          </Link>
        </div>
      </section>

      {mode ? (
        <ScriptStartModal
          key={mode}
          open
          mode={mode}
          onClose={closeModal}
          onConfirm={onConfirm}
        />
      ) : null}


      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>核心能力</div>
          <div className={styles.sectionHint}>更稳定、更可控</div>
        </div>

        <div className={styles.capabilityGrid}>
          <div className={styles.capabilityItem}>
            <div className={styles.capabilityTitle}>产出质量</div>
            <ul className={styles.bullets}>
              <li>自动梳理人物、冲突、推进点，减少遗漏</li>
              <li>逐场景生成，结构一致，便于后续视频生成</li>
              <li>支持返回修改输入，再次生成对比</li>
            </ul>
          </div>

          <div className={styles.capabilityItem}>
            <div className={styles.capabilityTitle}>效率体验</div>
            <ul className={styles.bullets}>
              <li>自动保存到内容库，随时继续编辑</li>
              <li>生成进度清晰可见，支持取消不中断已完成部分</li>
              <li>生成完成一键进入视频创作</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
