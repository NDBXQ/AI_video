
"use client"

import Link from "next/link"
import type { RefObject } from "react"
import styles from "./ChatSidebar.module.css"
import type { ThreadMessage, OutlineItem } from "../utils"

type ChatSidebarProps = Readonly<{
  rewriteMessages: ReadonlyArray<ThreadMessage>
  rewriteRequirements: string
  setRewriteRequirements: (val: string) => void
  handleRewrite: () => void
  activeOutline: OutlineItem | null
  isRewriteStreaming: boolean
  toast: { type: "error" | "success"; message: string } | null
  threadRef: RefObject<HTMLDivElement | null>
  onScrollThread: () => void
}>

/**
 * 右侧聊天栏组件
 * @param {ChatSidebarProps} props - 组件属性
 * @returns {JSX.Element} 组件内容
 */
export function ChatSidebar({
  rewriteMessages,
  rewriteRequirements,
  setRewriteRequirements,
  handleRewrite,
  activeOutline,
  isRewriteStreaming,
  toast,
  threadRef,
  onScrollThread
}: ChatSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>剧本创作</div>
        <div className={styles.sidebarActions}>
          <Link href="/library" className={styles.backLink}>
            去内容库
          </Link>
        </div>
      </div>

      <div className={styles.thread} ref={threadRef} onScroll={onScrollThread}>
        {rewriteMessages.map((m) => {
          if (m.role === "assistant" && !m.text.trim()) return null
          const wrapper = m.role === "user" ? styles.messageUser : styles.message
          const bubble = m.role === "user" ? styles.bubbleUser : styles.bubble
          return (
            <div key={m.id} className={wrapper}>
              <div
                className={m.role === "user" ? `${styles.avatar} ${styles.avatarUser}` : `${styles.avatar} ${styles.avatarAssistant}`}
                aria-label={m.role === "user" ? "你" : "助手"}
                title={m.role === "user" ? "你" : "助手"}
              >
                {m.role === "user" ? (
                  <svg className={styles.avatarIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 12.1a4.6 4.6 0 1 0-4.6-4.6 4.6 4.6 0 0 0 4.6 4.6ZM4.2 20.5a7.8 7.8 0 0 1 15.6 0"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg className={styles.avatarIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2.2l1.4 4.6 4.6 1.4-4.6 1.4L12 14.2l-1.4-4.6L6 8.2l4.6-1.4L12 2.2Z" fill="currentColor" />
                    <path d="M18.8 12.4l.9 3 3 .9-3 .9-.9 3-.9-3-3-.9 3-.9.9-3Z" fill="currentColor" opacity="0.75" />
                  </svg>
                )}
              </div>
              <div className={bubble}>{m.text}</div>
            </div>
          )
        })}
      </div>

      <div className={styles.composer}>
        <div className={styles.composerBlock}>
          <div className={styles.composerRow}>
            <textarea
              className={styles.textarea}
              placeholder="例如：强化人物情感线，增加对话与细节描写…"
              rows={2}
              value={rewriteRequirements}
              onChange={(e) => setRewriteRequirements(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                if (e.shiftKey) return
                if ((e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing) return
                e.preventDefault()
                void handleRewrite()
              }}
            />
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleRewrite}
              disabled={!activeOutline || (!isRewriteStreaming && !rewriteRequirements.trim())}
            >
              {isRewriteStreaming ? "停止" : "改写"}
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className={toast.type === "error" ? `${styles.toast} ${styles.toastError}` : `${styles.toast} ${styles.toastSuccess}`}>
          {toast.message}
        </div>
      ) : null}
    </aside>
  )
}
