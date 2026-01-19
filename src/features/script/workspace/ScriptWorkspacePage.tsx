import Link from "next/link"
import type { ReactElement } from "react"
import styles from "./ScriptWorkspacePage.module.css"
import { GenerateStoryboardTextLink } from "./GenerateStoryboardTextLink"

type ScriptWorkspaceMode = "source" | "brief"

type ScriptWorkspacePageProps = Readonly<{
  mode: ScriptWorkspaceMode
  storyId: string
  outline?: string
  outlines: ReadonlyArray<{
    outlineId: string
    sequence: number
    outlineText: string
    originalText: string
  }>
}>

/**
 * 剧本创作工作区页面（与参考图保持结构一致）
 * @param {ScriptWorkspacePageProps} props - 组件属性
 * @param {ScriptWorkspaceMode} props.mode - 进入模式（source/brief）
 * @param {string} props.storyId - 故事 ID
 * @returns {ReactElement} 页面内容
 */
export function ScriptWorkspacePage({
  mode,
  storyId,
  outline,
  outlines
}: ScriptWorkspacePageProps): ReactElement {
  const promptTitle = mode === "brief" ? "剧情简介" : "故事原文"
  const promptPlaceholder =
    mode === "brief"
      ? "请输入剧情简介，生成剧本大纲…"
      : "请输入故事原文，生成剧本大纲…"

  const outlineIndex = (() => {
    const parsed = Number(outline)
    if (!Number.isFinite(parsed)) return 1
    if (parsed < 1) return 1
    return Math.trunc(parsed)
  })()

  const activeOutline = outlines.find((o) => o.sequence === outlineIndex) ?? outlines[0] ?? null

  return (
    <main className={styles.main}>
      <section className={styles.grid}>
        <nav className={styles.outlineNav} aria-label="选择剧本大纲章节">
          <div className={styles.outlineNavHeader}>
            <div className={styles.outlineNavTitle}>大纲章节</div>
            <div className={styles.outlineNavHint}>选择后在右侧查看</div>
          </div>
          <div className={styles.outlineNavList}>
            {outlines.length === 0 ? (
              <div className={styles.outlineNavEmpty}>暂无大纲</div>
            ) : null}
            {outlines.map((item) => {
              const isActive = item.sequence === activeOutline?.sequence
              const href = `/script/workspace/${encodeURIComponent(storyId)}?mode=${mode}&outline=${item.sequence}`
              const subtitle = item.outlineText.replaceAll("\n", " ").trim().slice(0, 42)
              return (
                <Link
                  key={item.sequence}
                  href={href}
                  className={isActive ? styles.outlineNavItemActive : styles.outlineNavItem}
                >
                  <div className={styles.outlineNavItemTitle}>剧本大纲 {item.sequence}</div>
                  <div className={styles.outlineNavItemSub}>{subtitle || "（无摘要）"}</div>
                </Link>
              )
            })}
          </div>
        </nav>

        <section className={styles.preview}>
          <div className={styles.previewHeader}>
            <div className={styles.previewTitle}>
              {activeOutline ? `剧本大纲 ${activeOutline.sequence}` : "暂无大纲"}
            </div>
            <div className={styles.previewHint}>可在此查看生成内容（展示版）</div>
          </div>

          <article className={styles.markdown}>
            {activeOutline ? (
              <div className={styles.originalText}>{activeOutline.originalText}</div>
            ) : (
              <div className={styles.originalEmpty}>暂无可展示内容</div>
            )}
          </article>

          <div className={styles.nextStep}>
            <div className={styles.nextStepCard}>
              <div className={styles.nextStepText}>
                <div className={styles.nextStepTitle}>下一步：生成分镜文本</div>
                <div className={styles.nextStepDesc}>
                  基于当前大纲生成更细的场景描述与镜头文本，准备进入视频创作。
                </div>
              </div>
              <GenerateStoryboardTextLink
                className={styles.nextStepButton}
                href={`/script/storyboard?mode=${mode}&outline=${activeOutline?.sequence ?? 1}&storyId=${encodeURIComponent(
                  storyId
                )}`}
                outlines={outlines}
              >
                去生成分镜
              </GenerateStoryboardTextLink>
            </div>
          </div>
        </section>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>剧本创作</div>
            <Link href="/script" className={styles.backLink}>
              返回入口
            </Link>
          </div>

          <div className={styles.thread}>
            <div className={styles.message}>
              <div className={styles.messageMeta}>助手</div>
              <div className={styles.bubble}>
                好呀，把你的{promptTitle}发我，我会先生成可编辑的剧本大纲。
              </div>
            </div>

            <div className={styles.messageUser}>
              <div className={styles.messageMeta}>你</div>
              <div className={styles.bubbleUser}>
                {promptTitle}：这里放用户输入内容（示例占位）。
              </div>
            </div>

            <div className={styles.message}>
              <div className={styles.messageMeta}>助手</div>
              <div className={styles.bubble}>
                好呀，这是根据你的要求生成的剧本大纲：
                <div className={styles.outlineChips} aria-label="大纲条目">
                  {outlines.map((item) => {
                    const isActive = item.sequence === activeOutline?.sequence
                    const href = `/script/workspace/${encodeURIComponent(storyId)}?mode=${mode}&outline=${item.sequence}`
                    return (
                      <Link
                        key={item.sequence}
                        href={href}
                        className={isActive ? styles.outlineChipActive : styles.outlineChip}
                      >
                        <span className={styles.outlineChipIcon} aria-hidden="true" />
                        剧本大纲 {item.sequence}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.composer}>
            <div className={styles.composerHint}>输入{promptTitle}，可继续生成/优化大纲</div>
            <div className={styles.composerRow}>
              <textarea className={styles.textarea} placeholder={promptPlaceholder} rows={2} />
              <button type="button" className={styles.sendButton}>
                发送
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
