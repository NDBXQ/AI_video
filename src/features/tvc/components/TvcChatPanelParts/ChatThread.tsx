"use client"

import type { ReactElement, RefObject } from "react"
import styles from "../TvcChatPanel.module.css"
import type { ChatMessage } from "@/features/tvc/types"
import { AssistantContent } from "./AssistantContent"
import { MessageAttachments } from "./MessageAttachments"

function AvatarIcon({ role }: { role: "assistant" | "user" }): ReactElement {
  if (role === "user") {
    return (
      <svg className={styles.avatarIcon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
        <path
          d="M12 12.3c2.32 0 4.2-1.88 4.2-4.2S14.32 3.9 12 3.9 7.8 5.78 7.8 8.1s1.88 4.2 4.2 4.2ZM4.9 20.1c1.62-3.26 4.25-4.9 7.1-4.9s5.48 1.64 7.1 4.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg className={styles.avatarIcon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M8.4 12h7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.95" />
      <path d="M12 8.4v7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.95" />
      <circle cx="8.4" cy="12" r="1.2" fill="currentColor" opacity="0.95" />
      <circle cx="15.6" cy="12" r="1.2" fill="currentColor" opacity="0.95" />
      <circle cx="12" cy="8.4" r="1.2" fill="currentColor" opacity="0.8" />
      <circle cx="12" cy="15.6" r="1.2" fill="currentColor" opacity="0.8" />
      <path
        d="M12 5.3l.9 3.1 3.1.9-3.1.9-.9 3.1-.9-3.1-3.1-.9 3.1-.9.9-3.1Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  )
}

export function ChatThread({
  threadRef,
  messages,
  onAction
}: {
  threadRef: RefObject<HTMLDivElement | null>
  messages: ChatMessage[]
  onAction: (command: string) => void
}): ReactElement {
  return (
    <div className={styles.thread} ref={threadRef} aria-label="对话记录">
      {messages.map((m) => {
        const wrapper = m.role === "user" ? `${styles.message} ${styles.messageUser}` : styles.message
        const bubble = m.role === "user" ? `${styles.bubble} ${styles.bubbleUser}` : `${styles.bubble} ${styles.bubbleAssistant}`
        const avatar = m.role === "user" ? `${styles.avatar} ${styles.avatarUser}` : styles.avatar
        return (
          <div key={m.id} className={wrapper}>
            <div className={avatar} aria-label={m.role === "user" ? "你" : "助手"} title={m.role === "user" ? "你" : "助手"}>
              <AvatarIcon role={m.role} />
            </div>
            <div className={bubble}>
              {m.role === "assistant" ? <AssistantContent text={m.text} blocks={m.blocks} onAction={onAction} /> : <div>{m.text}</div>}
              <MessageAttachments attachments={m.attachments} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
